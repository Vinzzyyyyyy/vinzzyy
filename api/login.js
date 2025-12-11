import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "jwtsecret1239451923ur9ajwiaiwjamanpokoknYAmah";

// Global connection cache
let client;
let clientPromise;
if (!global._mongoClientPromise) {
  client = new MongoClient(uri, { useUnifiedTopology: true });
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

// Kirim OTP email
async function sendOTP(email, otp) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"Vinzzyy Verification" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Kode Verifikasi Akun",
    html: `<h2>Kode OTP kamu: <b>${otp}</b></h2>`
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const client = await clientPromise;
    const db = client.db("Database_Vinzzyy");
    const users = db.collection("UserData");

    if (req.method === "POST") {
      const { action, email, username, password, otp, adminToken, targetEmail, newPassword } = req.body;

      // REGISTER
      if (action === "register") {
        if (!email || !username || !password) {
          return res.status(400).json({ error: "Data tidak lengkap" });
        }

        const exist = await users.findOne({ email });
        if (exist) return res.status(409).json({ error: "Email sudah terdaftar" });

        const hashed = await bcrypt.hash(password, 10);
        const otpCode = crypto.randomInt(100000, 999999).toString();

        await users.insertOne({
          username,
          email,
          password: hashed,
          isVerified: false,
          role: "member",
          otp: otpCode,
          otpExpires: new Date(Date.now() + 15 * 60 * 1000),
        });

        await sendOTP(email, otpCode);

        return res.status(200).json({ message: "Register berhasil, cek email untuk verifikasi" });
      }

      // VERIFY OTP
      if (action === "verify") {
        const user = await users.findOne({ email });
        if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
        if (user.isVerified) return res.status(400).json({ error: "Akun sudah diverifikasi" });

        if (user.otp !== otp || new Date() > new Date(user.otpExpires)) {
          return res.status(400).json({ error: "OTP salah atau expired" });
        }

        await users.updateOne(
          { email },
          { $set: { isVerified: true }, $unset: { otp: "", otpExpires: "" } }
        );

        return res.status(200).json({ message: "Verifikasi berhasil, silakan login" });
      }

      // LOGIN
      if (action === "login") {
        const user = await users.findOne({ email });
        if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Password salah" });
        if (!user.isVerified) return res.status(403).json({ error: "Akun belum diverifikasi" });

        const token = jwt.sign(
          { id: user._id, email: user.email },
          JWT_SECRET,
          { expiresIn: "30m" }
        );

        return res.status(200).json({ message: "Login berhasil", token });
      }

      // ADMIN RESET PASSWORD
      if (action === "adminReset") {
        try {
          if (!adminToken || !targetEmail || !newPassword) {
            return res.status(400).json({ error: "Data tidak lengkap" });
          }

          // Verifikasi token admin
          let adminDecoded;
          try {
            adminDecoded = jwt.verify(adminToken, JWT_SECRET);
          } catch {
            return res.status(401).json({ error: "Token invalid / expired" });
          }

          const adminUser = await users.findOne({ email: adminDecoded.email });
          if (!adminUser) return res.status(404).json({ error: "Admin tidak ditemukan" });

          if (adminUser.role !== "admin") {
            return res.status(403).json({ error: "Akses ditolak, bukan admin" });
          }

          const targetUser = await users.findOne({ email: targetEmail });
          if (!targetUser) return res.status(404).json({ error: "User target tidak ditemukan" });

          const hashedNew = await bcrypt.hash(newPassword, 10);

          await users.updateOne(
            { email: targetEmail },
            { $set: { password: hashedNew } }
          );

          return res.status(200).json({ message: "Password user berhasil direset" });

        } catch (err) {
          console.error("❌ Error adminReset:", err);
          return res.status(500).json({ error: "Server error", detail: err.message });
        }
      }

      return res.status(400).json({ error: "Action tidak dikenali" });
    }

    return res.status(405).json({ error: "Method tidak diizinkan" });

  } catch (err) {
    console.error("❌ Error API:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
