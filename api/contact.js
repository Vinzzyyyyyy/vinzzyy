import { MongoClient } from "mongodb";

const mongo = new MongoClient(process.env.MONGODB_URI);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    const { name, email, message } = req.body;

    if (!name || !message) {
      return res.status(400).json({ message: "Data tidak lengkap." });
    }

    // KONEKSI MONGODB
    await mongo.connect();
    const db = mongo.db("Database_Vinzzyy");
    const contacts = db.collection("contacts");

    // Simpan data
    await contacts.insertOne({
      name,
      message,
      date: new Date()
    });

    // KIRIM WHATSAPP VIA FONNTE
    const waMsg = `Pesan Baru dari Website:\n\nNama: ${name}\nPesan: ${message}`;

    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": process.env.FONNTE_TOKEN,
      },
      body: new URLSearchParams({
        target: process.env.OWNER_NUMBER,
        message: waMsg,
      }),
    });

    return res.status(200).json({ message: "Pesan berhasil dikirim!" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
