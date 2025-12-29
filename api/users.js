import { MongoClient } from "mongodb";
import fetch from "node-fetch";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

/* =========================
   HELPER: GET GAME NAME
========================= */
async function getPlaceNames(placeIds = []) {
  if (!placeIds.length) return {};

  try {
    const res = await fetch(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeIds.join(",")}`
    );

    if (!res.ok) return {};

    const data = await res.json();
    const map = {};

    data.forEach(game => {
      map[game.placeId] = game.name;
    });

    return map;
  } catch (err) {
    console.error("Game resolver error:", err);
    return {};
  }
}

/* =========================
   MAIN HANDLER
========================= */
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await client.connect();
    const db = client.db("Database_Vinzzyy");
    const collection = db.collection("users");

    /* =========================
       GET USERS + PRESENCE
    ========================= */
    if (req.method === "GET") {
      const users = await collection.find({}).toArray();

      const userIds = users.map(u => u.id);

      let presenceMap = {};

      /* === ROBLOX PRESENCE === */
      try {
        const presenceRes = await fetch(
           "https://presence.roblox.com/v1/presence/users",
           {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ userIds })
           }
         );
         
         // === DEBUG SEMENTARA (WAJIB) ===
         console.log("Presence status:", presenceRes.status);
         
         const raw = await presenceRes.text();
         console.log("Presence raw:", raw);
         
         // parse manual biar aman
         let presenceData = {};
         try {
           presenceData = JSON.parse(raw);
         } catch {
           presenceData = {};
         }


        if (presenceRes.ok) {
          const presenceData = await presenceRes.json();
          presenceData.userPresences.forEach(p => {
            presenceMap[p.userId] = {
              type: p.userPresenceType, // 0-3
              placeId: p.placeId || null
            };
          });
        }
      } catch (err) {
        console.error("Presence error:", err);
      }

      /* === COLLECT PLACE IDs === */
      const placeIds = Object.values(presenceMap)
        .map(p => p.placeId)
        .filter(Boolean);

      const uniquePlaceIds = [...new Set(placeIds)];
      const placeNameMap = await getPlaceNames(uniquePlaceIds);

      /* === MERGE FINAL DATA === */
      const finalUsers = [];

      for (const user of users) {
        const presence = presenceMap[user.id] || {
          type: 0,
          placeId: null
        };

        // update displayName otomatis
        try {
          const r = await fetch(
            `https://users.roblox.com/v1/users/${user.id}`
          );
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

        finalUsers.push({
          ...user,
          presence: presence.type, // 0 offline | 1 online | 2 ingame | 3 studio
          placeId: presence.placeId,
          gameName: presence.placeId
            ? placeNameMap[presence.placeId] || "Unknown Game"
            : null,
          isEmergencyHamburg:
            placeNameMap[presence.placeId] === "Emergency Hamburg"
        });
      }

      return res.status(200).json(finalUsers);
    }

    /* =========================
       ADD USER
    ========================= */
    if (req.method === "POST") {
      const { username } = req.body;
      if (!username)
        return res.status(400).json({ error: "Username diperlukan" });

      const search = await fetch(
        "https://users.roblox.com/v1/usernames/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernames: [username] })
        }
      );

      const searchData = await search.json();
      if (!searchData?.data?.length) {
        return res.status(404).json({ error: "Username tidak ditemukan" });
      }

      const { id, name, displayName } = searchData.data[0];

      const exist = await collection.findOne({ id });
      if (exist)
        return res.status(409).json({ error: "User sudah ada di database" });

      await collection.insertOne({ id, name, displayName });
      return res.status(200).json({ message: "User berhasil ditambahkan" });
    }

    /* =========================
       DELETE USER
    ========================= */
    if (req.method === "DELETE") {
      const { username } = req.query;
      if (!username)
        return res.status(400).json({ error: "Username diperlukan" });

      const result = await collection.deleteOne({ name: username });
      if (result.deletedCount === 0) {
        return res
          .status(404)
          .json({ error: "Username tidak ditemukan di database" });
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
