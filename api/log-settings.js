import mongoose from "mongoose";

// Cache mongoose
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectMongo() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Schema
const LogSchema = new mongoose.Schema({
  ip: String,
  city: String,
  region: String,
  country_code: String,
  latitude: Number,
  longitude: Number,
  time: new Date()
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

const Log = mongoose.models.Log || mongoose.model("Log", LogSchema);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await connectMongo();

    if (req.method === "POST") {
      const { ip, city, region, country } = req.body;

      const existing = await Log.findOne({
        ip,
        city,
        region,
        country_code,
        time: { $gte: new Date() }
      });

      if (existing) {
        return res.status(200).json({
          success: true,
          skipped: true,
          message: "Log sudah ada, tidak disimpan ulang.",
        });
      }

      const log = new Log({
        ...req.body,
        time: new Date() // tetap simpan UTC
      });

      await log.save();

      return res.status(200).json({ success: true, log });
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
