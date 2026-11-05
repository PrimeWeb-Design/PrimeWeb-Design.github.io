// Anfragen aus Formular und Chat per E-Mail an Marc – direkt über das eigene Postfach (IONOS-SMTP), ohne Brevo.
// Zugangsdaten nur als Vercel-Umgebungsvariablen: SMTP_PASS (Pflicht), optional SMTP_USER, SMTP_HOST, SMTP_PORT.
// Kein Zusatzpaket nötig (package.json liegt nicht im Repo) – kleiner SMTP-Client mit Node-Bordmitteln.
const tls = require("tls");
const net = require("net");

const ZIEL = "marc@primeweb-design.de";

// Ein SMTP-Gespräch: verbinden (SSL auf 465, sonst Klartext nur für Tests), anmelden, Mail abgeben.
function smtpSenden({ host, port, user, pass, from, to, daten }) {
  return new Promise((resolve, reject) => {
    const sicher = port === 465;
    const sock = sicher ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    sock.setEncoding("utf8");
    sock.setTimeout(15000, () => { sock.destroy(); reject(new Error("SMTP Zeitüberschreitung")); });
    sock.on("error", reject);
    let puffer = "";
    const warteschlange = [];
    sock.on("data", (d) => {
      puffer += d;
      // vollständige Antwort: letzte Zeile „NNN text“ (ohne Bindestrich)
      let m;
      while ((m = puffer.match(/^(?:\d{3}-[^\r\n]*\r?\n)*(\d{3}) [^\r\n]*\r?\n/))) {
        puffer = puffer.slice(m[0].length);
        const w = warteschlange.shift();
        if (w) w(Number(m[1]), m[0]);
      }
    });
    const antwort = () => new Promise((ok) => warteschlange.push((code, text) => ok({ code, text })));
    const befehl = async (zeile, erwartet) => {
      const a = antwort();
      if (zeile !== null) sock.write(zeile + "\r\n");
      const { code, text } = await a;
      if (!erwartet.includes(code)) throw new Error(`SMTP ${code}: ${text.trim().slice(0, 200)}`);
      return text;
    };
    (async () => {
      await befehl(null, [220]);
      await befehl("EHLO primeweb-design.de", [250]);
      await befehl("AUTH LOGIN", [334]);
      await befehl(Buffer.from(user).toString("base64"), [334]);
      await befehl(Buffer.from(pass).toString("base64"), [235]);
      await befehl(`MAIL FROM:<${from}>`, [250]);
      await befehl(`RCPT TO:<${to}>`, [250, 251]);
      await befehl("DATA", [354]);
      // Punkte am Zeilenanfang verdoppeln (SMTP-Regel)
      await befehl(daten.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..") + "\r\n.", [250]);
      sock.write("QUIT\r\n");
      sock.end();
      resolve();
    })().catch((e) => { sock.destroy(); reject(e); });
  });
}

const kopf = (t) => "=?UTF-8?B?" + Buffer.from(t, "utf8").toString("base64") + "?=";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end("Nur POST");

  const body = req.body || {};
  // Eingaben begrenzen und für die HTML-Mail entschärfen
  const esc = (v, n) => String(v || "").slice(0, n).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const formular = body.source === "formular";
  const name    = esc(body.name || "Unbekannt", 100);
  const email   = String(body.email || "").slice(0, 100).replace(/[\r\n<>]/g, "");
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const message = esc(body.message, formular ? 3000 : 500).replace(/\n/g, "<br>");
  const zeilen = formular
    ? [["Unternehmen", esc(body.company, 150)], ["Telefon", esc(body.phone, 50)], ["Paket", esc(body.package, 100)], ["Website", esc(body.website, 200)]]
        .filter(([, v]) => v).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join("")
    : "";
  const art = formular ? "Formular-Anfrage" : "Chat-Anfrage";

  const html = `<h2>Neue ${art} von ${name}</h2>
<p><strong>Name:</strong> ${name}</p>
<p><strong>E-Mail:</strong> ${esc(email, 100)}</p>
${zeilen}
<p><strong>Nachricht:</strong><br>${message}</p>
<p><em>Gesendet über ${formular ? "das Anfrageformular auf primeweb-design.de" : "den PrimeWeb Chat-Assistenten"}</em></p>`;

  const user = process.env.SMTP_USER || ZIEL;
  const pass = process.env.SMTP_PASS;
  if (!pass) { console.error("lead: SMTP_PASS fehlt in den Vercel-Umgebungsvariablen"); return res.status(500).end("Mail failed: pass-fehlt"); }

  const betreff = `Neue ${art}: ${String(body.company || body.name || "Unbekannt").replace(/[\r\n]/g, " ").slice(0, 100)}`;
  const daten = [
    `From: ${kopf(formular ? "PrimeWeb Anfrage" : "PrimeWeb Chat")} <${user}>`,
    `To: <${ZIEL}>`,
    emailOk ? `Reply-To: <${email}>` : null,
    `Subject: ${kopf(betreff)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@primeweb-design.de>`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n"),
  ].filter((z) => z !== null).join("\r\n");

  try {
    await smtpSenden({
      host: process.env.SMTP_HOST || "smtp.ionos.de",
      port: Number(process.env.SMTP_PORT || 465),
      user, pass, from: user, to: ZIEL, daten,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("lead: Versand fehlgeschlagen –", e.message);
    // grobe Ursache ohne Details zurückgeben (hilft bei der Fehlersuche, verrät nichts Geheimes)
    const m = String(e.message);
    const grund = /^SMTP 53\d/.test(m) ? "anmeldung" : /^SMTP 5[05]\d/.test(m) ? "abgelehnt-" + m.slice(5, 8) : /^SMTP/.test(m) ? "smtp-" + m.slice(5, 8) : /Zeit/.test(m) ? "zeitueberschreitung" : "verbindung";
    return res.status(500).end("Mail failed: " + grund);
  }
};
