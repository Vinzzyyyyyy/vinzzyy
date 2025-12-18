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
      blockedAt: {
        type: Date,
        default: () => new Date(), // UTC default
        get: (v) => toWIB(v)        // convert ke WIB saat dikirim
      }
    })
  );

function toWIB(date) {
  return new Date(new Date(date).getTime() + 7 * 60 * 60 * 1000);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.end();

  try {
    const { ip, country_code } = req.body || {};

    if (!ip || !country_code) {
      return res.status(400).json({
        allowed: false,
        reason: "INVALID_PAYLOAD"
      });
    }

    await connectMongo();

    const blocked = await BlockIP.findOne({ ip });
    if (blocked) {
      return res.status(403).json({
        allowed: false,
        reason: "IP_BLOCKED"
      });
    }

    if (geo.country_code !== "ID") {
      await BlockIP.updateOne(
        { ip },
        {
          $set: {
            ip,
            reason: `Country blocked: ${geo.country_code}`,
            source: "country",
            blockedAt: {
              type: Date,
              default: () => new Date(), // UTC default
              get: (v) => toWIB(v)        // convert ke WIB saat dikirim
            }
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

  } catch (err) {
    return res.status(500).json({
      allowed: false,
      reason: "ERROR_SERVER"
    });
  }
}
