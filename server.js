require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("./db");

const app = express();
const publicDir = __dirname;
const port = process.env.PORT || 8000;
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.use(express.json());
app.use((req, res, next) => {
  const blockedFiles = [
    "/server.js",
    "/db.js",
    "/package.json",
    "/package-lock.json",
    "/.env",
    "/.env.example"
  ];

  if (blockedFiles.includes(req.path) || req.path.startsWith("/scripts/")) {
    return res.status(404).send("Not found");
  }

  return next();
});
app.use(express.static(publicDir, {
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store");
    }
  }
}));

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email
    },
    jwtSecret
  );
}

function auth(requiredRole) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : String(req.query.token || "");

    if (!token) {
      return res.status(401).json({ message: "Please login first." });
    }

    try {
      const user = jwt.verify(token, jwtSecret);
      if (requiredRole && user.role !== requiredRole) {
        return res.status(403).json({ message: "You do not have access to this page." });
      }
      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Your session has expired. Please login again." });
    }
  };
}

function monthLabel(value) {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function receiptText(receipt, customer) {
  return [
    "Vikings Livinn Monthly Rent Receipt",
    "------------------------------------",
    `Receipt No: ${receipt.receiptNumber}`,
    `Customer: ${customer.name}`,
    `Email: ${customer.email}`,
    `Phone: ${customer.phone || "-"}`,
    `Room: ${customer.room || "-"}`,
    `Month: ${monthLabel(receipt.month)}`,
    `Rent Amount: Rs. ${receipt.amount}`,
    `Payment Date: ${new Date(receipt.paymentDate).toLocaleDateString("en-IN")}`,
    `Generated On: ${new Date(receipt.createdAt).toLocaleDateString("en-IN")}`,
    "",
    "Thank you for staying with Vikings Livinn."
  ].join("\n");
}

app.post("/api/login", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const db = await connectToDatabase();
  const user = await db.collection("users").findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  if (user.status === "inactive") {
    return res.status(403).json({ message: "This login is inactive." });
  }

  res.json({
    token: signToken(user),
    role: user.role,
    name: user.name,
    redirectTo: user.role === "admin" ? "/admin.html" : "/customer.html"
  });
}));

app.get("/api/me", auth(), (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/admin/customers", auth("admin"), asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const phone = String(req.body.phone || "").trim();
  const room = String(req.body.room || "").trim();

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required." });
  }

  const db = await connectToDatabase();
  const existing = await db.collection("users").findOne({ email });
  if (existing) {
    return res.status(409).json({ message: "A login already exists for this email." });
  }

  const result = await db.collection("users").insertOne({
    name,
    email,
    phone,
    room,
    role: "customer",
    status: "active",
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date()
  });

  res.status(201).json({
    message: "Customer login created.",
    customer: { id: result.insertedId, name, email, phone, room }
  });
}));

app.get("/api/admin/customers", auth("admin"), asyncHandler(async (req, res) => {
  const db = await connectToDatabase();
  const customers = await db.collection("users")
    .find({ role: "customer" }, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({ customers });
}));

app.post("/api/admin/receipts", auth("admin"), asyncHandler(async (req, res) => {
  const customerId = String(req.body.customerId || "");
  const month = String(req.body.month || "");
  const amount = Number(req.body.amount || 0);
  const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();

  if (!ObjectId.isValid(customerId) || !month || !amount) {
    return res.status(400).json({ message: "Customer, month and amount are required." });
  }

  const db = await connectToDatabase();
  const customer = await db.collection("users").findOne({ _id: new ObjectId(customerId), role: "customer" });

  if (!customer) {
    return res.status(404).json({ message: "Customer not found." });
  }

  const receipt = {
    customerId: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    month,
    amount,
    paymentDate,
    receiptNumber: `VL-${month.replace("-", "")}-${Date.now().toString().slice(-6)}`,
    createdAt: new Date()
  };

  const result = await db.collection("receipts").insertOne(receipt);
  res.status(201).json({
    message: "Receipt generated.",
    receipt: { ...receipt, _id: result.insertedId }
  });
}));

app.get("/api/admin/complaints", auth("admin"), asyncHandler(async (req, res) => {
  const db = await connectToDatabase();
  const complaints = await db.collection("complaints")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  res.json({ complaints });
}));

app.patch("/api/admin/complaints/:id", auth("admin"), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const status = String(req.body.status || "").trim();

  if (!ObjectId.isValid(id) || !["Open", "In Progress", "Resolved"].includes(status)) {
    return res.status(400).json({ message: "Valid complaint and status are required." });
  }

  const db = await connectToDatabase();
  await db.collection("complaints").updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, updatedAt: new Date() } }
  );

  res.json({ message: "Complaint status updated." });
}));

app.get("/api/customer/receipts", auth("customer"), asyncHandler(async (req, res) => {
  const db = await connectToDatabase();
  const receipts = await db.collection("receipts")
    .find({ customerId: new ObjectId(req.user.id) })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({ receipts });
}));

app.get("/api/customer/receipts/:id/download", auth("customer"), asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send("Invalid receipt.");
  }

  const db = await connectToDatabase();
  const receipt = await db.collection("receipts").findOne({
    _id: new ObjectId(id),
    customerId: new ObjectId(req.user.id)
  });
  const customer = await db.collection("users").findOne({ _id: new ObjectId(req.user.id) });

  if (!receipt || !customer) {
    return res.status(404).send("Receipt not found.");
  }

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="${receipt.receiptNumber}.txt"`);
  res.send(receiptText(receipt, customer));
}));

app.post("/api/customer/complaints", auth("customer"), asyncHandler(async (req, res) => {
  const subject = String(req.body.subject || "").trim();
  const message = String(req.body.message || "").trim();

  if (!subject || !message) {
    return res.status(400).json({ message: "Subject and complaint details are required." });
  }

  const db = await connectToDatabase();
  await db.collection("complaints").insertOne({
    customerId: new ObjectId(req.user.id),
    customerName: req.user.name,
    customerEmail: req.user.email,
    subject,
    message,
    status: "Open",
    createdAt: new Date()
  });

  res.status(201).json({ message: "Complaint submitted." });
}));

app.get("/login", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    message: error.message.includes("MONGODB_URI")
      ? "MongoDB Atlas connection is not configured. Add MONGODB_URI to .env."
      : "Server error. Please try again."
  });
});

app.listen(port, () => {
  console.log(`Vikings Livinn running on http://localhost:${port}`);
});
