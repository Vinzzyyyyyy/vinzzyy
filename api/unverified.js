import { MongoClient } from "mongodb";
import jwt from "jsonwebtoken";

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

let client;
let clientPromise;
if (!global._mongoClientPromise) {
  client = new MongoClient(uri, { useUnifiedTopology: true });
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token diperlukan" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const client = await clientPromise;
    const db = client.db("Database_Vinzzyy");
    const users = db.collection("UserData");

    const admin = await users.findOne({ email: decoded.email });
    if (!admin || admin.role !== "admin")
      return res.status(403).json({ error: "Akses ditolak" });

    const result = await users
      .find({ isVerified: false })
      .project({ password: 0 })
      .toArray();

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
