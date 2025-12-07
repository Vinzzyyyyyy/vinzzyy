// api/geo.js
export default async function handler(req, res) {
  // CORS agar bisa diakses frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Ambil IP dengan prioritas Cloudflare → Vercel → Forwarded → socket
    const cfIp = req.headers["cf-connecting-ip"];
    const vercelIp = req.headers["x-vercel-ip"] || req.headers["x-real-ip"];
    const forwarded = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    const rawIp =
      cfIp || vercelIp || forwarded || req.socket?.remoteAddress || "0.0.0.0";

    const ip = rawIp.replace("::ffff:", "");

    // Ambil info dari header Vercel/Cloudflare
    const countryHeader =
      req.headers["x-vercel-ip-country"] ||
      req.headers["x-vercel-ipcountry"] ||
      req.headers["cf-ipcountry"];

    const headerCity =
      req.headers["x-vercel-ip-city"] || req.headers["x-vercel-ipcity"];

    const headerPostal =
      req.headers["x-vercel-ip-postal-code"] ||
      req.headers["x-vercel-ip-postalcode"] ||
      req.headers["x-vercel-ip-postal"];

    const result = {
      ip,
      country_code: countryHeader || null,
      country: null, // akan terisi dari ipapi
      city: headerCity || null,
      postal: headerPostal || null,
      source: countryHeader || headerCity ? "vercel-headers" : "fallback-ipapi"
    };

    // Fallback ke ipapi jika data tidak lengkap
    if (!result.city || !result.postal || !result.country_code) {
      const lookupIp = ip === "0.0.0.0" ? "" : ip;
      const resp = await fetch(`https://ipapi.co/${lookupIp}/json/`);

      if (resp.ok) {
        const data = await resp.json();

        result.country_code =
          result.country_code || data.country || data.country_code || null;

        result.country = data.country_name || null;

        result.city = result.city || data.city || null;

        result.postal = result.postal || data.postal || null;

        result.source = "ipapi";
      }
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: "failed",
      detail: String(err)
    });
  }
}
