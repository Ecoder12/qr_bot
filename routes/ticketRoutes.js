const express = require("express");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2");




const router = express.Router();
router.get("/", (req, res) => {
    res.render("form");
});


// MySQL Connection
const db = mysql.createConnection({
    host: "oakter.cuzlniri5zxa.ap-south-1.rds.amazonaws.com",
    user: "root",
    password: "poiuytrewq",
    database: "qr_system"
});

// Generate Ticket with QR Code & PDF
router.post("/generate-ticket", async (req, res) => {
    const { campusAmbassadorID, fullName, phoneNumber, emailAddress, ticketType, category, paymentMethod, quantity, transaction_id } = req.body;

    // Generate QR Code
    const qrData = `${fullName} | ${ticketType} | ${category} | ${paymentMethod}`;
    const qrImagePath = path.join(__dirname, "../public/qrcode.png");

    await QRCode.toFile(qrImagePath, qrData);

    // Store ticket details
    const ticket = {
        promoterID: campusAmbassadorID,
        fullName,
        phoneNumber,
        emailAddress,
        ticketType,
        category,
        paymentMethod,
        quantity,
        transaction_id: paymentMethod === "UPI" ? transaction_id : null,
        qrCodeURL: "/qrcode.png", // QR Code accessible via public folder
    };

    // Render ticket.ejs with ticket data
    res.render("ticket", { ticket });
});

// Route to generate and download PDF ticket
router.get("/download-ticket", async (req, res) => {
    const { fullName, phoneNumber, emailAddress, ticketType, category, paymentMethod,quantity, transaction_id } = req.query;

    // Generate Unique Code (Always 6 Characters)
    const uniqueCode = "LOCALUZ-" + Math.random().toString(36).substring(2, 8).toUpperCase(); // e.g. "TVERYCX9A2P"

    // Get Current Date (DDMM format)
    const now = new Date();
    const dateMonth = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Unique PDF Name
    const pdfFilename = `${fullName.replace(/\s+/g, '_')}_${uniqueCode}_${dateMonth}.pdf`;
    const pdfPath = path.join(__dirname, "../public", pdfFilename);

    // Generate QR Code
    const qrData = `${fullName} | ${ticketType} | ${category} | ${paymentMethod}`;
    const qrPath = path.join(__dirname, "../public/qrcode.png");
    await QRCode.toFile(qrPath, qrData);

    // Generate PDF Ticket
    const doc = new PDFDocument({ size: "A4", margins: { top: 30, left: 50, right: 50, bottom: 30 } });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // HEADER
    doc.font("Helvetica-Bold").fontSize(28).fillColor("#FF6F00").text("LOCALUZ EVENT TICKET", { align: "center" });

    doc.moveDown(1.5);

    // Ticket Details Section
    doc.font("Helvetica").fontSize(16).fillColor("#333");

    doc.text(`Name: ${fullName}`);
    doc.moveDown(1);

    doc.text(`Phone: ${phoneNumber}`);
    doc.moveDown(1);
    doc.text(`Email: ${emailAddress}`);
    doc.moveDown(1);
    doc.text(`Ticket Type: ${ticketType}`);
    doc.moveDown(1);
    doc.text(`Category: ${category}`);
    doc.moveDown(1);
    doc.text(`Payment Method: ${paymentMethod}`);
    doc.moveDown(1);
    doc.text(`Quantity: ${quantity}`);
    if (paymentMethod === "UPI") doc.text(`Transaction ID: ${transaction_id}`);

    doc.moveDown(1.5);

    // QR Code Section
    doc.image(qrPath, { fit: [150, 150], align: "center" });

    // Unique Code Below QR
    doc.moveDown(4);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#064f25").text(`Unique Code: ${uniqueCode}`, { align: "center" });

    // Footer
    doc.moveDown(5);
    doc.font("Helvetica-Oblique").fontSize(12).fillColor("#555").text("This ticket is valid for entry. Please show it at the event gate.");

    doc.end();

    stream.on("finish", () => {
        res.download(pdfPath, pdfFilename, (err) => {
            if (err) console.error(err);
            fs.unlinkSync(pdfPath);
            fs.unlinkSync(qrPath);
        });
    });
});



// Validate QR Code
router.post("/validate-qr", (req, res) => {
    const { qrData } = req.body;
    const { campusAmbassadorID, emailAddress, paymentMethod, transaction_id } = JSON.parse(qrData);

    let query = "SELECT * FROM tickets WHERE campusAmbassadorID = ? AND emailAddress = ?";
    let params = [campusAmbassadorID, emailAddress];

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
router.get("/view-all-tickets", (req, res) => {
    db.query("SELECT * FROM tickets", (err, tickets) => {
        if (err) return res.status(500).json({ error: err.message });
        res.render("view-all-tickets", { tickets });
    });
});

module.exports = router;
