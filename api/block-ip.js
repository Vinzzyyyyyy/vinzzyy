import mongoose from "mongoose";

let cached = global.mongoose || (global.mongoose = { conn: null, promise: null });

async function connectMongo() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

const BlockIPSchema = new mongoose.Schema({
  ip: { type: String, unique: true },
  reason: String,
  source: { type: String, default: "Blacklisted By Admin" },
  blockDevice: { type: Boolean, default: false }, // 🔥 NEW
  blockedAt: { type: Date, default: Date.now }
});

const BlockIP =
  mongoose.models.BlockIP || mongoose.model("BlockIP", BlockIPSchema);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  await connectMongo();

  /* GET LIST */
  if (req.method === "GET") {
    const list = await BlockIP.find().sort({ blockedAt: -1 });
    return res.json({ success: true, list });
  }

  /* ADD / UPDATE */
  if (req.method === "POST") {
    const { ip, reason, blockDevice } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });

    await BlockIP.updateOne(
      { ip },
      { $set: {ip, reason, blockDevice: !!blockDevice, source: "Blacklisted By Admin" }
      },
      { upsert: true }
    );

    return res.json({ success: true });
  }

  /* DELETE */
  if (req.method === "DELETE") {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });

    await BlockIP.deleteOne({ ip });
    return res.json({ success: true });
  }

  return res.status(405).end();
}
