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

const BlockIP =
  mongoose.models.BlockIP || mongoose.model(
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  try {
    const geoRes = await fetch("https://api.vinzzyy.my.id/api/geo");
    const geo = await geoRes.json();
    
    const ip = geo.ip;
    
    if (!ip) {
      return res.status(403).json({ allowed: false });
    }

    await connectMongo();

    // 1️⃣ cek DB block
    const blocked = await BlockIP.findOne({ ip });
    if (blocked) {
      return res.status(403).json({ allowed: false });
    }
    
    if (geo.country_code !== "ID") {
      await BlockIP.updateOne(
        { ip },
        {
          $set: {
            ip,
            reason: `Country blocked: ${geo.country_code}`,
            source: "country",
            blockedAt: new Date()
          }
        },
        { upsert: true }
      );

      return res.status(403).json({
        allowed: false,
        reason: "COUNTRY_NOT_ALLOWED"
      });
    }

    return res.json({ allowed: true });
  } catch {
    return res.status(403).json({ allowed: false });
  }
}
