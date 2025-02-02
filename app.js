const express = require("express");
const QRCode = require("qrcode");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require('fs');
const archiver = require('archiver');
const { query } = require('mysql');
const PDFDocument = require('pdfkit');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// MySQL Connection
const db = mysql.createConnection({
    host: "oakter.cuzlniri5zxa.ap-south-1.rds.amazonaws.com",
    user: "root",
    password: "poiuytrewq",
    database: "qr_system"
});

db.connect((err) => {
    if (err) throw err;
    console.log("Connected to MySQL!");
});

// Generate QR Code and Store Ticket Info
app.post("/generate-qr", (req, res) => {
    const { campusAmbassadorID, fullName, phoneNumber, emailAddress, ticketType, category, paymentMethod, transaction_id } = req.body;
    const TicketVerify = 'Ticket Verified Successfully!';
    
    // Create QR data including Transaction ID only if payment method is UPI
    const qrData = JSON.stringify({
        TicketVerify,
        campusAmbassadorID,
        fullName,
        phoneNumber,
        emailAddress,
        ticketType,
        category,
        paymentMethod,
        ...(paymentMethod === "UPI" && { transaction_id }) // Add transaction_id only if payment method is UPI
    });

    QRCode.toDataURL(qrData, (err, qrCode) => {
        if (err) return res.status(500).json({ error: err.message });

        const ticketData = {
            campusAmbassadorID,
            fullName,
            phoneNumber,
            emailAddress,
            ticketType,
            category,
            paymentMethod,
            qrCode,
            ...(paymentMethod === "UPI" && { transaction_id }) // Store transaction_id only for UPI
        };

        db.query("INSERT INTO tickets SET ?", ticketData, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            // Redirect to the success page with the QR Code and ticket details
            res.render("ticket", { ticketData });
        });
    });
});

// Validate QR Code and Show Registration Details
app.post("/validate-qr", (req, res) => {
    const { qrData } = req.body;
    const { campusAmbassadorID, emailAddress, fullName, phoneNumber, ticketType, category, paymentMethod, transaction_id } = JSON.parse(qrData);

    let query = "SELECT * FROM tickets WHERE campusAmbassadorID = ? AND emailAddress = ?";
    let params = [campusAmbassadorID, emailAddress];

    // Include transaction_id in the query if payment method is UPI
    if (paymentMethod === "UPI") {
        query += " AND transaction_id = ?";
        params.push(transaction_id);
    }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            res.json({ message: "Ticket Verified", ticket: results[0] });
        } else {
            res.status(400).json({ message: "Invalid Ticket" });
        }
    });
});

// View All Tickets
app.get("/view-all-tickets", (req, res) => {
    db.query("SELECT * FROM tickets", (err, tickets) => {
        if (err) return res.status(500).json({ error: err.message });
        res.render("view-all-tickets", { tickets }); // Pass tickets to EJS view
    });
});

// Serve the Form Page
app.get("/", (req, res) => {
    res.render("form");
});

// Create 'downloads' folder if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}
const sharp = require('sharp');
// Route for downloading QR code and ticket details as a PDF
// Route for downloading the QR code and ticket details as a PDF
app.get("/download-ticket-image/:campusAmbassadorID", (req, res) => {
    const { campusAmbassadorID } = req.params;

    // Query the database to get the ticket details based on Campus Ambassador ID
    db.query("SELECT * FROM tickets WHERE campusAmbassadorID = ?", [campusAmbassadorID], (err, results) => {
        if (err) {
            console.error('Database query failed:', err);
            return res.status(500).json({ error: err.message });
        }

        if (results.length > 0) {
            const ticket = results[0];

            // Create a new PDF document
            const doc = new PDFDocument();
            const filePath = path.join(__dirname, 'downloads', `ticket-${ticket.campusAmbassadorID}.pdf`);

            // Create a writable stream for the file
            doc.pipe(fs.createWriteStream(filePath));

            // Generate the QR code
            const qrImagePath = path.join(__dirname, 'temp-qr.png');
            QRCode.toFile(qrImagePath, ticket.campusAmbassadorID, (err) => {
                if (err) {
                    console.error('Error generating QR code:', err);
                    return res.status(500).json({ error: err.message });
                }

                // Add QR code to the PDF document
                doc.image(qrImagePath, 50, 50, { width: 100 });

                // Add ticket details to the PDF
                const ticketDetails = `
Campus Ambassador ID: ${ticket.campusAmbassadorID}
Full Name: ${ticket.fullName}
Phone Number: ${ticket.phoneNumber}
Email Address: ${ticket.emailAddress}
Ticket Type: ${ticket.ticketType}
Category: ${ticket.category}
Payment Method: ${ticket.paymentMethod}
Transaction ID: ${ticket.transaction_id || 'N/A'}
                `;
                doc.text(ticketDetails, 50, 200);

                // End the document (finalize PDF)
                doc.end();

                // Wait for the document to finish generating
                doc.on('finish', () => {
                    console.log('PDF file generated successfully at:', filePath);

                    // Check if the file exists before sending it
                    if (fs.existsSync(filePath)) {
                        // Send the PDF file to the client
                        res.download(filePath, `ticket-${ticket.campusAmbassadorID}.pdf`, (err) => {
                            if (err) {
                                console.error('Error during file download:', err);
                                return res.status(500).json({ error: 'Failed to download file' });
                            }
                            // Cleanup after download
                            fs.unlinkSync(filePath);  // Delete the generated PDF
                            fs.unlinkSync(qrImagePath);  // Delete the temporary QR code image
                        });
                    } else {
                        console.error('File not found:', filePath);
                        res.status(404).json({ error: 'File not found' });
                    }
                });
            });
        } else {
            console.error('Ticket not found for ID:', campusAmbassadorID);
            res.status(404).json({ message: "Ticket not found" });
        }
    });
});
// Start the server
app.listen(5000, () => console.log("Server running on port http://localhost:5000"));
