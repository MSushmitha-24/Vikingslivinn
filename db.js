const { MongoClient } = require("mongodb");

let client;
let database;

async function connectToDatabase() {
  if (database) {
    return database;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "vikings_livinn";

  if (!uri) {
    throw new Error("MONGODB_URI is missing. Add it to your .env file.");
  }

  client = new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);

  await database.collection("users").createIndex({ email: 1 }, { unique: true });
  await database.collection("receipts").createIndex({ customerId: 1, month: 1 });
  await database.collection("complaints").createIndex({ customerId: 1, createdAt: -1 });

  return database;
}

async function closeDatabase() {
  if (client) {
    await client.close();
  }

  client = null;
  database = null;
}

module.exports = {
  connectToDatabase,
  closeDatabase
};
