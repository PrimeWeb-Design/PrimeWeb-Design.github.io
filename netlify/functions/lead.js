const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Invalid JSON" }; }

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

  const options = {
    hostname: "api.brevo.com",
    path: "/v3/smtp/email",
    method: "POST",
    headers: {
      "api-key":      process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept":       "application/json",
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ ok: true }),
        });
      });
    });
    req.on("error", () => resolve({ statusCode: 500, body: "Mail failed" }));
    req.write(payload);
    req.end();
  });
};
