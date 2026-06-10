require("dotenv").config();

const bcrypt = require("bcryptjs");
const { connectToDatabase, closeDatabase } = require("../db");

async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env.");
  }

  const db = await connectToDatabase();
  const existing = await db.collection("users").findOne({ email });

  if (existing) {
    await db.collection("users").updateOne(
      { email },
      {
        $set: {
          role: "admin",
          status: "active",
          passwordHash: await bcrypt.hash(password, 10),
          updatedAt: new Date()
        },
        $setOnInsert: {
          name: "Admin",
          createdAt: new Date()
        }
      }
    );
    console.log(`Admin login updated for ${email}`);
    return;
  }

  await db.collection("users").insertOne({
    name: "Admin",
    email,
    role: "admin",
    status: "active",
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date()
  });

  console.log(`Admin login created for ${email}`);
}

seedAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
