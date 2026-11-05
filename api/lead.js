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
  // Eingaben begrenzen und für die HTML-Mail entschärfen
  const esc = (v, n) => String(v || "").slice(0, n).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const formular = body.source === "formular";
  const name    = esc(body.name || "Unbekannt", 100);
  const email   = String(body.email || "").slice(0, 100).replace(/[\r\n<>]/g, "");
  const message = esc(body.message, formular ? 3000 : 500).replace(/\n/g, "<br>");
  const zeilen = formular
    ? [["Unternehmen", esc(body.company, 150)], ["Telefon", esc(body.phone, 50)], ["Paket", esc(body.package, 100)], ["Website", esc(body.website, 200)]]
        .filter(([, v]) => v).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join("")
    : "";
  const art = formular ? "Formular-Anfrage" : "Chat-Anfrage";

  const html = `
    <h2>Neue ${art} von ${name}</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>E-Mail:</strong> ${esc(email, 100)}</p>
    ${zeilen}
    <p><strong>Nachricht:</strong><br>${message}</p>
    <p><em>Gesendet über ${formular ? "das Anfrageformular auf primeweb-design.de" : "den PrimeWeb Chat-Assistenten"}</em></p>
  `;

  const senders = [
    { key: process.env.BREVO_API_KEY,   from: "marc@primeweb-design.de" },
    { key: process.env.BREVO_API_KEY_2, from: "Marc@precisionpart.de" },
  ].filter(s => s.key);

  for (const { key, from } of senders) {
    const p = JSON.stringify({
      sender:      { name: formular ? "PrimeWeb Anfrage" : "PrimeWeb Chat", email: from },
      to:          [{ email: "marc@primeweb-design.de" }],
      replyTo:     { email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : from },
      subject:     `Neue ${art}: ${String(body.company || body.name || "Unbekannt").replace(/[\r\n]/g, " ").slice(0, 100)}`,
      htmlContent: html,
    });
    try {
      await sendViaBrevo(key, p);
      return res.status(200).json({ ok: true });
    } catch (e) {
      // try next key
    }
  }

  return res.status(500).end("Mail failed");
};
