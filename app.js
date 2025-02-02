const express = require("express");
const QRCode = require("qrcode");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const path = require("path");
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
    const { campusAmbassadorID, fullName, phoneNumber, emailAddress, ticketType, category, paymentMethod } = req.body;
    const TicketVerify = 'Ticket Verified Successfully!'
    const qrData = JSON.stringify({ TicketVerify, campusAmbassadorID, fullName, phoneNumber, emailAddress, ticketType, category, paymentMethod });

    QRCode.toDataURL(qrData, (err, qrCode) => {
        if (err) return res.status(500).json({ error: err.message });

        const ticketData = { campusAmbassadorID, fullName, phoneNumber, emailAddress, ticketType, category, paymentMethod, qrCode };
        db.query("INSERT INTO tickets SET ?", ticketData, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            // Redirect to the success page with the QR Code and ticket ID
            res.render("ticket", { ticketData });
        });
    });
});

// Validate QR Code and Show Registration Details
app.post("/validate-qr", (req, res) => {
    const { qrData } = req.body;
    const { campusAmbassadorID, emailAddress,  fullName, phoneNumber, ticketType, category, paymentMethod } = JSON.parse(qrData);

    db.query("SELECT * FROM tickets WHERE campusAmbassadorID = ? AND emailAddress = ?", [campusAmbassadorID, emailAddress,  fullName, phoneNumber, ticketType, category, paymentMethod], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            res.json({ message: "Ticket Verified", ticket: results[0] });
        } else {
            res.status(400).json({ message: "Invalid Ticket" });
        }
    });
});

// Serve the Form Page
app.get("/", (req, res) => {
    res.render("form");
});

// Start the server
app.listen(5000, () => console.log("Server running on port http://localhost:5000"));
