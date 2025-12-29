import { MongoClient } from "mongodb";
import fetch from "node-fetch";

const uri = process.env.MONGODB_URI; // MongoDB Atlas URI
const client = new MongoClient(uri);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await client.connect();
    const db = client.db("Database_Vinzzyy");
    const collection = db.collection("users");

    if (req.method === "GET") {
      const users = await collection.find({}).toArray();
    
      // ambil semua userId Roblox
      const userIds = users.map(u => u.id);
    
      // === ROBLOX PRESENCE CHECK ===
      let presenceMap = {};
      try {
        const presenceRes = await fetch(
          "https://presence.roblox.com/v1/presence/users",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds })
          }
        );
    
        if (presenceRes.ok) {
          const presenceData = await presenceRes.json();
          presenceData.userPresences.forEach(p => {
            presenceMap[p.userId] = p.userPresenceType;
          });
        }
      } catch (e) {
        console.error("Presence error:", e);
      }
    
      // update displayName + inject presence
      const updatedUsers = await Promise.all(
        users.map(async (user) => {
          try {
            const r = await fetch(`https://users.roblox.com/v1/users/${user.id}`);
            if (r.ok) {
              const data = await r.json();
              if (data.displayName && data.displayName !== user.displayName) {
                await collection.updateOne(
                  { id: user.id },
                  { $set: { displayName: data.displayName } }
                );
                user.displayName = data.displayName;
              }
            }
          } catch {}
    
          return {
            ...user,
            presence: presenceMap[user.id] ?? 0
            // 0 offline | 1 online | 2 in game | 3 studio
          };
        })
      );
    
      return res.status(200).json(updatedUsers);
    }

    if (req.method === "POST") {
      const { username } = req.body;
      if (!username) return res.status(400).json({ error: "Username diperlukan" });

      // cek ke Roblox API → ambil id
      const search = await fetch(`https://users.roblox.com/v1/usernames/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username] }),
      });
      const searchData = await search.json();
      if (!searchData?.data?.length) {
        return res.status(404).json({ error: "Username tidak ditemukan" });
      }

      const { id, name, displayName } = searchData.data[0];

      // cek kalau udah ada
      const exist = await collection.findOne({ id });
      if (exist) return res.status(409).json({ error: "User sudah ada di database" });

      await collection.insertOne({ id, name, displayName });
      return res.status(200).json({ message: "User berhasil ditambahkan" });
    }

    if (req.method === "DELETE") {
      const { username } = req.query;
      if (!username) return res.status(400).json({ error: "Username diperlukan" });

      const result = await collection.deleteOne({ name: username });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Username tidak ditemukan di database" });
      }

      return res.status(200).json({ message: "User berhasil dihapus" });
    }

    return res.status(405).json({ error: "Method tidak diizinkan" });
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    await client.close();
  }
}
