import mongoose from "mongoose";

/* ================= MONGO CACHE ================= */
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectMongo() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

/* ================= UTIL ================= */
const toWIB = (d) => new Date(new Date(d).getTime() + 7 * 3600000);

/* ================= SCHEMA ================= */
const LogSchema = new mongoose.Schema({
  ip: String,
  country_code: String,
  region: String,
  city: String,
  postal: String,
  latitude: Number,
  longitude: Number,
  timezone: String,
  time: { type: Date, default: () => new Date(), get: v => toWIB(v) }
}, { toJSON: { getters: true } });

const BlockSchema = new mongoose.Schema({
  ip: { type: String, unique: true },
  reason: String,
  blockedAt: { type: Date, default: () => new Date() }
});

const Log = mongoose.models.Log || mongoose.model("Log", LogSchema);
const BlockedIP = mongoose.models.BlockedIP || mongoose.model("BlockedIP", BlockSchema);

/* ================= HANDLER ================= */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await connectMongo();
    const { mode } = req.query;

    /* ======================================================
       MAIN IP GUARD (DIPAKAI MIDDLEWARE / FRONTEND)
    ====================================================== */
    if (req.method === "POST" && !mode) {

      // Ambil IP user (REAL IP)
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress;

      // Ambil GEO dari API SENDIRI
      const geoRes = await fetch("https://api.vinzzyy.my.id/api/geo", {
        headers: { "x-forwarded-for": ip }
      });

      const geo = await geoRes.json();

      /* ===== 1. CEK BLOCK MANUAL ===== */
      const manualBlock = await BlockedIP.findOne({ ip: geo.ip });
      if (manualBlock) {
        return res.status(403).json({
          blocked: true,
          reason: manualBlock.reason || "Blocked by admin"
        });
      }

      /* ===== 2. CEK COUNTRY ===== */
      if (geo.country_code !== "ID") {
        return res.status(403).json({
          blocked: true,
          reason: "Country restricted"
        });
      }

      /* ===== 3. SIMPAN LOG (1x / hari) ===== */
      const startWIB = toWIB(new Date());
      startWIB.setHours(0, 0, 0, 0);
      const startUTC = new Date(startWIB.getTime() - 7 * 3600000);

      const exist = await Log.findOne({
        ip: geo.ip,
        time: { $gte: startUTC }
      });

      if (!exist) {
        await new Log({
          ip: geo.ip,
          country_code: geo.country_code,
          region: geo.region,
          city: geo.city,
          postal: geo.postal,
          latitude: geo.latitude,
          longitude: geo.longitude,
          timezone: geo.timezone
        }).save();
      }

      // LULUS
      return res.status(200).json({ blocked: false });
    }

    /* ======================================================
       ADMIN: BLOCK IP
    ====================================================== */
    if (req.method === "POST" && mode === "block") {
      const { ip, reason } = req.body;

      await BlockedIP.updateOne(
        { ip },
        { $set: { reason } },
        { upsert: true }
      );

      return res.json({ success: true });
    }

    /* ======================================================
       ADMIN: UNBLOCK IP
    ====================================================== */
    if (req.method === "POST" && mode === "unblock") {
      await BlockedIP.deleteOne({ ip: req.body.ip });
      return res.json({ success: true });
    }

    /* ======================================================
       ADMIN: LIST BLOCKED IP
    ====================================================== */
    if (req.method === "GET" && mode === "blocked-list") {
      const list = await BlockedIP.find().sort({ blockedAt: -1 });
      return res.json({ success: true, list });
    }

    return res.status(405).json({ error: "Invalid request" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
