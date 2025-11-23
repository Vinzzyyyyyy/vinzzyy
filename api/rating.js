import mongoose from "mongoose";

// ======================
// Koneksi MongoDB
// ======================
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "Database_Vinzzyy",
  });

  isConnected = true;
  console.log("MongoDB connected");
}

// ======================
// Schema
// ======================
const RatingSchema = new mongoose.Schema({
  name: String,
  rate: Number,
  message: String,
  HideName: Boolean,
  date: { type: Date, default: Date.now }
});

// ======================
// Model
// ======================
const Rating =
  mongoose.models.Rating || mongoose.model("Rating", RatingSchema);

// ======================
// Helper: samarkan nama
// ======================
function maskName(name) {
  if (!name) return "";
  if (name.length <= 2) return name[0] + "*".repeat(name.length - 1);
  return name.slice(0, 2) + "*".repeat(name.length - 2);
}

// ======================
// API Handler
// ======================
export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  await connectDB();

  // ----------------------
  // POST: tambah rating
  // ----------------------
  if (req.method === "POST") {
    try {
      const { name, rate, message, HideName } = req.body;

      // Cek nama sudah ada atau belum
      const exist = await Rating.findOne({ name });
      if (exist) {
        return res.status(400).json({
          success: false,
          error: "Nama sudah digunakan, tidak boleh duplikat."
        });
      }

      const rating = await Rating.create({
        name,
        rate,
        message,
        HideName
      });

      return res.status(200).json({ success: true, rating });

    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ----------------------
  // GET: ambil semua rating
  // ----------------------
  if (req.method === "GET") {
    try {
      const ratings = await Rating.find().sort({ date: -1 });

      const modified = ratings.map(r => ({
        ...r._doc,
        name: r.HideName ? maskName(r.name) : r.name
      }));

      return res.status(200).json(modified);

    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ----------------------
  // METHOD lain: tolak
  // ----------------------
  return res.status(405).json({ error: "Method not allowed" });
}
