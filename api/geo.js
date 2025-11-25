// api/geo.js
// Deploy ini ke Vercel (Serverless Function). Mengambil data geo dari header Vercel jika tersedia,
// jika tidak, fallback ke ipapi.co untuk info city/postal/lat-lon.

export default async function handler(req, res) {  
  try {
    // 1) Prioritas: header dari Cloudflare (jika ada) -> Vercel headers -> x-forwarded-for -> remoteAddress
    const cfIp = req.headers['cf-connecting-ip'];
    const vercelIp = req.headers['x-vercel-ip'] || req.headers['x-real-ip'];
    const forwarded = req.headers['x-forwarded-for']?.split(',')[0]?.trim();
    const ip = (cfIp || vercelIp || forwarded || req.socket?.remoteAddress || '0.0.0.0').replace('::ffff:', '');

    // 2) Ambil geodata langsung dari header Vercel jika ada (x-vercel-ip-*)
    const maybeCountry = req.headers['x-vercel-ip-country'] || req.headers['x-vercel-ipcountry'] || req.headers['cf-ipcountry'];
    const maybeCity = req.headers['x-vercel-ip-city'] || req.headers['x-vercel-ipcity'];
    const maybePostal = req.headers['x-vercel-ip-postal-code'] || req.headers['x-vercel-ip-postalcode'] || req.headers['x-vercel-ip-postal'];
    const maybeLat = req.headers['x-vercel-ip-latitude'] || req.headers['x-vercel-ip-lat'];
    const maybeLon = req.headers['x-vercel-ip-longitude'] || req.headers['x-vercel-ip-long'];

    // Build result with header values when available
    const result = {
      ip,
      country: maybeCountry || null,
      city: maybeCity || null,
      postal: maybePostal || null,
      latitude: maybeLat ? parseFloat(maybeLat) : null,
      longitude: maybeLon ? parseFloat(maybeLon) : null,
      source: maybeCountry || maybeCity ? 'vercel-headers' : 'fallback-ipapi'
    };

    // 3) Jika header geodata tidak memadai (city/postal/lat lon kosong), fallback ke ipapi.co
    if (!result.city || !result.latitude || !result.longitude || !result.postal) {
      // hati-hati rate limit ipapi (gratis) — buat caching jika dipakai banyak
      const ipForLookup = ip === '0.0.0.0' ? '' : ip; // ipapi.co tanpa IP = lookup requestor IP (not preferred)
      const resp = await fetch(`https://ipapi.co/${ipForLookup}/json/`);
      if (resp.ok) {
        const data = await resp.json();
        result.ip = data.ip || result.ip;
        result.country = result.country || data.country_name || data.country;
        result.city = result.city || data.city;
        result.postal = result.postal || data.postal;
        result.latitude = result.latitude || data.latitude || (data.latitude ? parseFloat(data.latitude) : null);
        result.longitude = result.longitude || data.longitude || (data.longitude ? parseFloat(data.longitude) : null);
        result.source = 'ipapi';
      }
    }

    // 4) Kirim response JSON
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'failed', detail: String(err) });
  }
}
