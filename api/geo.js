// api/geo.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Ambil IP dari berbagai header (prioritas cloudflare -> vercel -> x-forwarded-for)
    const cfIp = req.headers["cf-connecting-ip"];
    const vercelIp = req.headers["x-vercel-ip"] || req.headers["x-real-ip"];
    const forwarded = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    const rawIp =
      cfIp || vercelIp || forwarded || req.socket?.remoteAddress || "0.0.0.0";

    const ip = rawIp.replace("::ffff:", "");

    // === ALL HEADER LOKASI VERSEL & CLOUDFLARE ===
    const info = {
      // IP
      ip,

      // COUNTRY
      country_code:
        req.headers["x-vercel-ip-country"] ||
        req.headers["x-vercel-ipcountry"] ||
        req.headers["cf-ipcountry"] ||
        null,

      // REGION
      region:
        req.headers["x-vercel-ip-country-region"] ||
        req.headers["x-vercel-ip-region"] ||
        req.headers["cf-region"] ||
        null,

      // CITY
      city:
        req.headers["x-vercel-ip-city"] ||
        req.headers["x-vercel-ipcity"] ||
        req.headers["cf-city"] ||
        null,

      // POSTAL / ZIP
      postal:
        req.headers["x-vercel-ip-postal-code"] ||
        req.headers["x-vercel-ip-postal"] ||
        req.headers["x-vercel-ip-zip"] ||
        req.headers["cf-postal-code"] ||
        null,

      // LAT/LON
      latitude:
        req.headers["x-vercel-ip-latitude"] ||
        req.headers["cf-latitude"] ||
        null,

      longitude:
        req.headers["x-vercel-ip-longitude"] ||
        req.headers["cf-longitude"] ||
        null,

      // TIMEZONE
      timezone:
        req.headers["x-vercel-ip-timezone"] ||
        req.headers["cf-timezone"] ||
        null,

      // METRO CODE (khusus US biasanya)
      metro:
        req.headers["x-vercel-ip-metro-code"] ||
        req.headers["cf-metro-code"] ||
        null,

      // Lain-lain (identitas server edge)
      vercel_edge_id: req.headers["x-vercel-id"] || null,

      source: "vercel-headers"
    };

    // Kalau country/city/region kosong → fallback ipapi
    if (!info.country_code || !info.city || !info.region) {
      const lookupIp = ip === "0.0.0.0" ? "" : ip;
      const resp = await fetch(`https://ipapi.co/${lookupIp}/json/`);

      if (resp.ok) {
        const data = await resp.json();

        info.country_code = info.country_code || data.country || data.country_code || null;
        info.country = data.country_name || null;
        info.city = info.city || data.city || null;
        info.region = info.region || data.region || null;
        info.postal = info.postal || data.postal || null;
        info.latitude = info.latitude || data.latitude || null;
        info.longitude = info.longitude || data.longitude || null;
        info.timezone = info.timezone || data.timezone || null;

        info.source = "ipapi";
      }
    }

    res.status(200).json(info);
  } catch (err) {
    res.status(500).json({
      error: "failed",
      detail: String(err)
    });
  }
}
