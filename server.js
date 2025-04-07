const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the "uploads" directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Database Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Siddarth@2005", // Update with your MySQL password if required
    database: "student_requests_db",
});

db.connect((err) => {
    if (err) throw err;
    console.log("✅ Connected to MySQL Database: student_requests_db");
});

// Multer File Upload Configuration
const storage = multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// API: Submit Maintenance Request
app.post("/submit", upload.single("proof"), (req, res) => {
    console.log("Submit Request Body:", req.body);
    const { reg_no, student_name, block, room_no, work_type, request_category, comments } = req.body;
    const proof = req.file ? req.file.filename : null;

    const sql = "INSERT INTO maintenance_requests (reg_no, student_name, block, room_no, work_type, request_category, comments, proof) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [reg_no, student_name, block, room_no, work_type, request_category, comments, proof];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error inserting maintenance request:", err);
            return res.status(500).send({ error: "Error inserting maintenance request" });
        }
        res.send({ message: "Request submitted successfully!" });
    });
});

// API: Fetch All Requests
app.get("/requests", (req, res) => {
    db.query("SELECT * FROM maintenance_requests", (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// API: Download Proof File for a given request
app.get("/download/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "uploads", filename);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error("File does not exist:", filePath);
            return res.status(404).send("File not found on server.");
        }
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error("Error during file download:", err);
                res.status(500).send("Error downloading file");
            } else {
                console.log("File downloaded successfully:", filename);
            }
        });
    });
});

// API: Export All Requests to PDF
app.get("/export/pdf", (req, res) => {
    db.query("SELECT * FROM maintenance_requests", (err, results) => {
        if (err) return res.status(500).send(err);

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 30, size: "A4" });

        // Set headers for PDF file download
        res.setHeader("Content-Disposition", 'attachment; filename="requests.pdf"');
        res.setHeader("Content-Type", "application/pdf");

        // Pipe the PDF into the response
        doc.pipe(res);

        // Add title
        doc.fontSize(20).text("Student Maintenance Requests", { align: "center" });
        doc.moveDown();

        // Iterate through each record and add details to the PDF
        results.forEach((request) => {
            doc.fontSize(12).text(`ID: ${request.id}`);
            doc.text(`Registration No: ${request.reg_no}`);
            doc.text(`Student Name: ${request.student_name}`);
            doc.text(`Block: ${request.block}`);
            doc.text(`Room No: ${request.room_no}`);
            doc.text(`Work Type: ${request.work_type}`);
            doc.text(`Request Category: ${request.request_category}`);
            doc.text(`Comments: ${request.comments || "N/A"}`);
            doc.text(`Proof File: ${request.proof || "None"}`);
            doc.moveDown();
            // Add a horizontal line between records
            doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
            doc.moveDown();
        });

        // Finalize the PDF and end the stream
        doc.end();
    });
});

// API: Export All Requests to Excel
app.get("/export/excel", (req, res) => {
    db.query("SELECT * FROM maintenance_requests", async (err, results) => {
        if (err) return res.status(500).send(err);

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Maintenance Requests");

        // Define worksheet columns matching your SQL fields
        worksheet.columns = [
            { header: "ID", key: "id", width: 10 },
            { header: "Registration No", key: "reg_no", width: 20 },
            { header: "Student Name", key: "student_name", width: 25 },
            { header: "Block", key: "block", width: 15 },
            { header: "Room No", key: "room_no", width: 10 },
            { header: "Work Type", key: "work_type", width: 15 },
            { header: "Request Category", key: "request_category", width: 20 },
            { header: "Comments", key: "comments", width: 30 },
            { header: "Proof", key: "proof", width: 20 },
        ];

        // Add each request as a row in the worksheet
        results.forEach(request => {
            worksheet.addRow(request);
        });

        // Set response headers for Excel file download
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="requests.xlsx"'
        );

        // Write the workbook to the response and end the stream
        await workbook.xlsx.write(res);
        res.end();
    });
});

// API: Register User (Sign Up)
app.post("/register", (req, res) => {
    console.log("Registration Request Body:", req.body);
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
        return res.status(400).json({ error: "All fields are required" });
    }
    
    const sql = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
    const values = [username, password, role];
    
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error inserting user:", err);
            return res.status(500).json({ error: "Registration failed" });
        }
        res.json({ success: true, message: "User registered successfully!" });
    });
});

// API: Login User
app.post("/login", (req, res) => {
    console.log("Login Request Body:", req.body);
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }
    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error("Error fetching user:", err);
            return res.status(500).json({ error: "Login failed" });
        }

        if (results.length > 0) {
            const user = results[0];
            // Fixed typo: using "view.html" instead of "veiw.html"
            const redirectPage = user.role === "student" ? "index.html" : "view.html";
            res.json({ success: true, redirect: redirectPage });
        } else { 
            res.status(401).json({ error: "Invalid credentials" });
        }
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
