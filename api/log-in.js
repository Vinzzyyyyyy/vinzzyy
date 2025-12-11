import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const uri = process.env.MONGODB_URI;
const JWT_SECRET =
  process.env.JWT_SECRET || "jwtsecret1239451923ur9ajwiaiwjamanpokoknYAmah";

let client;
let clientPromise;
if (!global._mongoClientPromise) {
  client = new MongoClient(uri, { useUnifiedTopology: true });
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const client = await clientPromise;
    const db = client.db("Database_Vinzzyy");
    const users = db.collection("UserData");

    if (req.method !== "POST")
      return res.status(405).json({ error: "Method tidak diizinkan" });

    const {
      action,
      email,
      username,
      password,
      adminToken,
      targetEmail,
      newRole,
      newPassword
    } = req.body;

    // REGISTER (tanpa OTP)
    if (action === "register") {
      if (!email || !username || !password)
        return res.status(400).json({ error: "Data tidak lengkap" });

      const exist = await users.findOne({ email });
      if (exist) return res.status(409).json({ error: "Email sudah digunakan" });

      const hashed = await bcrypt.hash(password, 10);

      await users.insertOne({
        username,
        email,
        password: hashed,
        isVerified: false, // verifikasi manual admin
        role: "member",
      });

      return res.status(200).json({
        message: "Register berhasil, menunggu verifikasi admin",
      });
    }

    // LOGIN (user harus verified)
    if (action === "login") {
      const user = await users.findOne({ email });
      if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: "Password salah" });

      if (!user.isVerified)
        return res
          .status(403)
          .json({ error: "Akun belum diverifikasi admin" });

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "30m" }
      );

      return res.status(200).json({ message: "Login berhasil", token });
    }

    // ADMIN VALIDASI + PROMOTE ROLE
    if (action === "adminVerify") {
      if (!adminToken)
        return res.status(401).json({ error: "Token admin diperlukan" });

      let decoded;
      try {
        decoded = jwt.verify(adminToken, JWT_SECRET);
      } catch {
        return res.status(403).json({ error: "Token invalid / expired" });
      }

      const admin = await users.findOne({ email: decoded.email });
      if (!admin || admin.role !== "admin")
        return res.status(403).json({ error: "Akses ditolak" });

      const targetUser = await users.findOne({ email: targetEmail });
      if (!targetUser)
        return res.status(404).json({ error: "User target tidak ditemukan" });

      await users.updateOne(
        { email: targetEmail },
        {
          $set: {
            isVerified: true,
            role: newRole === "admin" ? "admin" : "member",
          },
        }
      );

      return res.status(200).json({
        message: `User berhasil diverifikasi dan role diset: ${
          newRole === "admin" ? "admin" : "member"
        }`,
      });
    }

    // ADMIN RESET PASSWORD
    if (action === "adminReset") {
      if (!adminToken || !targetEmail || !newPassword)
        return res.status(400).json({ error: "Data tidak lengkap" });

      let decoded;
      try {
        decoded = jwt.verify(adminToken, JWT_SECRET);
      } catch {
        return res.status(403).json({ error: "Token invalid" });
      }

      const admin = await users.findOne({ email: decoded.email });
      if (!admin || admin.role !== "admin")
        return res.status(403).json({ error: "Akses ditolak" });

      const target = await users.findOne({ email: targetEmail });
      if (!target)
        return res.status(404).json({ error: "User target tidak ditemukan" });

      const hashed = await bcrypt.hash(newPassword, 10);

      await users.updateOne(
        { email: targetEmail },
        { $set: { password: hashed } }
      );

      return res.status(200).json({
        message: "Password user berhasil direset oleh admin",
      });
    }

    return res.status(400).json({ error: "Action tidak dikenali" });
  } catch (err) {
    console.error("API ERROR:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
