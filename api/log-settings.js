import { MongoClient } from "mongodb";
import fetch from "node-fetch";

const uri = process.env.MONGODB_URI; // MongoDB Atlas URI
const client = new MongoClient(uri);

// Schema
const LogSchema = new mongoose.Schema({
  ip: String,
  city: String,
  region: String,
  country_code: String,
  latitude: Number,
  longitude: Number,
  time: {
    type: Date,
    default: Date.now
  }
});


const Log = mongoose.models.Log || mongoose.model("Log", LogSchema);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await client.connect();
    const db = client.db("Database_Vinzzyy");
    const collection = db.collection("logs");

    if (req.method === "POST") {
  const { ip, city, region, country_code, latitude, longitude } = req.body;

  if (!ip) {
    return res.status(400).json({
      success: false,
      error: "IP is required"
    });
  }

  // Cegah spam log (1 IP / 5 menit)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
// cek kalau udah ada
  const exist = await collection.findOne({ ip });
  if (exist) return res.status(409).json({ error: "User sudah ada di database" });

  await collection.insertOne({ ip, city, region, country_code, latitude, longitude });   
  return res.status(200).json({
    success: true,
    log
  });
}

    if (req.method === "GET") {
      const logs = await Log.find().sort({ time: -1 }).limit(20);
      return res.status(200).json({ success: true, logs });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
