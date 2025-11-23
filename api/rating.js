import mongoose from "mongoose";

// Koneksi MongoDB (biar ga connect berkali-kali)
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "Database_Vinzzyy",
  });

  isConnected = true;
  console.log("MongoDB connected");
}

// Schema (table)
const RatingSchema = new mongoose.Schema({
  name: String,
  rate: Number,
  message: String,
  showName: Boolean,
  date: { type: Date, default: Date.now }
});

// Model (collection)
const Rating =
  mongoose.models.Rating || mongoose.model("Rating", RatingSchema);

// ========================================================
// HANDLER API
// ========================================================

export default async function handler(req, res) {// CORS headers 
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Preflight (OPTIONS) 
  if (req.method === "OPTIONS") { return res.status(200).end(); }
  await connectDB();

  if (req.method === "POST") {
    // Tambah rating
    try {
      const rating = await Rating.create(req.body);
      return res.status(200).json({ success: true, rating });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === "GET") {
    // Ambil semua rating
    try {
      const ratings = await Rating.find().sort({ date: -1 });
      return res.status(200).json(ratings);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Method tidak diizinkan
  return res.status(405).json({ error: "Method not allowed" });
}
