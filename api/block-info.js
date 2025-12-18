import mongoose from "mongoose";

let cached = global.mongoose || (global.mongoose = { conn: null, promise: null });

async function connectMongo() {
  if (cached.conn) return cached.conn;
  cached.promise ||= mongoose.connect(process.env.MONGODB_URI);
  cached.conn = await cached.promise;
  return cached.conn;
}

const BlockIP =
  mongoose.models.BlockIP ||
  mongoose.model(
    "BlockIP",
    new mongoose.Schema({
      ip: String,
      reason: String,
      source: String,
      blockedAt: Date
    })
  );

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const { ip } = req.query;
    if (!ip) return res.json({ found: false });

    await connectMongo();
    const data = await BlockIP.findOne({ ip });

    if (!data) return res.json({ found: false });

    res.json({
      found: true,
      reason: data.reason,
      source: data.source,
      blockedAt: data.blockedAt
    });
  } catch {
    res.json({ found: false });
  }
}
