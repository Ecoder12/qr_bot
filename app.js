const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const fs = require("fs");

// Import Routes
const ticketRoutes = require("./routes/ticketRoutes");

const app = express();

// Middleware
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

// Routes
app.use("/", ticketRoutes);

// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
