const https = require("https");

function sendViaBrevo(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };
    const req = https.request(options, (r) => {
      let data = "";
      r.on("data", (chunk) => (data += chunk));
      r.on("end", () => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(data);
        else reject(new Error(`Brevo ${r.statusCode}: ${data}`));
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const body = req.body || {};
  const name    = (body.name    || "Unbekannt").slice(0, 100);
  const email   = (body.email   || "").slice(0, 100);
  const message = (body.message || "").slice(0, 500);

  const html = `
    <h2>Neue Chat-Anfrage von ${name}</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>E-Mail:</strong> ${email}</p>
    <p><strong>Nachricht:</strong><br>${message}</p>
    <p><em>Gesendet über den PrimeWeb Chat-Assistenten</em></p>
  `;

  const payload = JSON.stringify({
    sender:      { name: "PrimeWeb Chat", email: "marc@primeweb-design.de" },
    to:          [{ email: "marc@primeweb-design.de" }],
    replyTo:     { email: email || "marc@primeweb-design.de" },
    subject:     `Neue Chat-Anfrage: ${name}`,
    htmlContent: html,
  });

  const keys = [process.env.BREVO_API_KEY, process.env.BREVO_API_KEY_2].filter(Boolean);

  for (const key of keys) {
    try {
      await sendViaBrevo(key, payload);
      return res.status(200).json({ ok: true });
    } catch (e) {
      // try next key
    }
  }

  return res.status(500).end("Mail failed");
};
