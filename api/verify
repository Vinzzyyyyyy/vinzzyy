export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: "Token missing" });
    }

    // Verify ke Cloudflare
    const verifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    const formData = new URLSearchParams();
    formData.append("secret", process.env.TURNSTILE_SECRET); // simpan di Vercel ENV
    formData.append("response", token);

    const result = await fetch(verifyURL, {
      method: "POST",
      body: formData
    }).then(r => r.json());

    if (result.success) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({
        success: false,
        error: result["error-codes"] ?? "Unknown error"
      });
    }

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
