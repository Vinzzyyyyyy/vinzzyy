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
  // preflight CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  try {
    // 1️⃣ ambil IP client dulu
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim();

    if (!ip) {
      return res.status(403).json({
        allowed: false,
        reason: "IP_NOT_FOUND"
      });
    }

    // 2️⃣ panggil geo API pakai IP itu
    const geoRes = await fetch(
      "https://api.vinzzyy.my.id/api/geo",
      { headers: { "x-forwarded-for": ip } }
    );

    if (!geoRes.ok) {
      throw new Error("GEO_API_FAILED");
    }

    const geo = await geoRes.json();

    await connectMongo();

    // 3️⃣ cek DB block
    const blocked = await BlockIP.findOne({ ip });
    if (blocked) {
      return res.status(403).json({
        allowed: false,
        reason: "IP_BLOCKED"
      });
    }

    // 4️⃣ cek country
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

    // 5️⃣ lolos
    return res.json({ allowed: true });

  } catch (err) {
    console.error("IP-GUARD ERROR:", err.message);
    return res.status(403).json({
      allowed: false,
      reason: "ERROR_SERVER"
    });
  }
}
