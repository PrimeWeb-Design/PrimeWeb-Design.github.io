const https = require("https");

const SYSTEM_PROMPT = `Du bist ein freundlicher Assistent von PrimeWeb Design – einer Webdesign-Agentur speziell für lokale Unternehmen und Handwerksbetriebe in Deutschland.

Dein Ziel: Besucher beraten und zur Kontaktaufnahme / Anfrage motivieren.

Über PrimeWeb Design:
- Inhaber: Marc Daub
- Kontakt: marc@primeweb-design.de | +49 157 817 74883
- Website: www.primeweb-design.de

Pakete & Preise:
- Landing Page: ab 1.490 € – ideal für Einsteiger, eine Seite, schnell online
- Business-Website: ab 3.490 € – mehrere Seiten, professionell, SEO-optimiert
- Logo Design: auf Anfrage
- Brand Identity Paket: auf Anfrage
- Beratung: ab 590 €

Leistungen:
- Moderne, mobiloptimierte Websites
- SEO-Optimierung für lokale Suchen
- Transparente Festpreise, keine versteckten Kosten
- Schnelle Umsetzung
- Spezialisiert auf Handwerk, Dienstleister, lokale Betriebe

Wichtige Regeln:
- Antworte IMMER auf Deutsch
- Halte Antworten kurz und freundlich (max. 3-4 Sätze)
- Bei konkretem Interesse: empfehle das kostenlose 15-Minuten-Gespräch mit Marc
- Keine erfundenen Informationen – nur was oben steht`;

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

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const userMessage = (body.message || "").slice(0, 500);
  const history = (body.history || []).slice(-6);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role === "model" ? "assistant" : m.role, content: m.text })),
    { role: "user", content: userMessage },
  ];

  const payload = JSON.stringify({
    model: "llama-3.3-70b-versatile",
    messages,
    max_tokens: 256,
    temperature: 0.7,
  });

  const apiKey = process.env.GROQ_API_KEY;
  const options = {
    hostname: "api.groq.com",
    path: "/openai/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const text = json.choices?.[0]?.message?.content || "Entschuldigung, ich konnte keine Antwort generieren.";
          resolve({
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ reply: text }),
          });
        } catch {
          resolve({ statusCode: 500, body: "Parse error" });
        }
      });
    });
    req.on("error", () => resolve({ statusCode: 500, body: "Request failed" }));
    req.write(payload);
    req.end();
  });
};
