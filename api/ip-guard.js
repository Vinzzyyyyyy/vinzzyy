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

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const ip =
      req.headers["x-vercel-forwarded-for"] ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim();

    if (!ip) {
      return res.json({ allowed: true });
    }

    const geoRes = await fetch(
      "https://api.vinzzyy.my.id/api/geo",
      { headers: { "x-forwarded-for": ip } }
    );

    const geo = await geoRes.json();

    await connectMongo();

    const blocked = await BlockIP.findOne({ ip });
    if (blocked) {
      return res.status(403).json({
        allowed: false,
        reason: "IP_BLOCKED"
      });
    }

    if (geo.country_code !== "ID") {
      return res.status(403).json({
        allowed: false,
        reason: "COUNTRY_NOT_ALLOWED"
      });
    }

    return res.json({ allowed: true });

  } catch (err) {
    console.error(err);
    return res.status(403).json({
      allowed: false,
      reason: "ERROR_SERVER"
    });
  }
}
