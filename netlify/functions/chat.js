const https = require("https");

const SYSTEM_PROMPT = `Du bist ein freundlicher Verkaufsassistent von PrimeWeb Design – einer Premium-Webdesign-Agentur für lokale Unternehmen und Handwerksbetriebe in Deutschland.

Dein Ziel: Besucher kompetent beraten und zur Kontaktaufnahme motivieren.

Über PrimeWeb Design:
- Inhaber: Marc Daub
- Telefon: +49 157 817 74883
- E-Mail: marc@primeweb-design.de
- Website: www.primeweb-design.de

PAKETE & PREISE (immer beide Stufen erklären):

1. Luxury Landing Page
   - Einstieg: ab 499 € – einfache, saubere Seite, schnell online, ideal für den Start
   - Premium: ab 1.490 € – hochwertige Gestaltung, gold-schwarze Bildsprache, klare Conversion
   - Für wen: Einzelunternehmer, Freelancer, Betriebe die erstmals online gehen

2. Signature Website (beliebtestes Paket)
   - Einstieg: ab 999 € – mehrere Seiten, professionelles Design, Kontaktformular
   - Premium: ab 3.490 € – Premium-Look, Konzept, Textelemente, Anfrageführung, SEO
   - Für wen: Handwerksbetriebe, Dienstleister, lokale Unternehmen mit Anspruch

3. Premium Relaunch
   - Einstieg: ab 1.799 € – bestehende Website aufwerten
   - Premium: ab 4.490 € – kompletter Neuauftritt, starke Wirkung, Vertrauen aufbauen
   - Für wen: Unternehmen mit veralteter Website die mehr Anfragen wollen

4. Online-Shop Signature
   - Einstieg: ab 2.499 € – professioneller Shop
   - Premium: ab 4.990 € – luxuriöser Shop mit starker Produktpräsentation
   - Für wen: Unternehmen die online verkaufen wollen

Unterschied Einstieg vs. Premium:
- Einstieg: funktional, sauber, professionell – ideal für kleines Budget. Kein Logo, kein SEO inklusive.
- Premium: exklusives Design, gold-schwarze Bildsprache, filmische Qualität, maximale Wirkung. Logo-Design und SEO-Optimierung inklusive.
- Mehr Seiten: bei allen Paketen außer Landing Page inklusive
- Pflegepaket: bei beiden Stufen optional buchbar (Preis auf Anfrage)

LIEFERZEIT:
- Generell 2–4 Wochen, abhängig vom Paket und Projektumfang
- Genaue Lieferzeit wird individuell im Erstgespräch besprochen

ZAHLUNG:
- 50% Anzahlung bei Projektstart
- 50% bei Fertigstellung und Übergabe
- Keine versteckten Kosten, Festpreise

TERMIN VEREINBAREN:
- Kein Online-Kalender vorhanden
- Direkt Marc anrufen: +49 157 817 74883
- Oder per E-Mail: marc@primeweb-design.de
- Kostenlose 15-Minuten-Ersteinschätzung möglich – kein Druck, kein Standardangebot

WARUM PRIMEWEB DESIGN:
- Keine Baukastensysteme – alles individuell entwickelt
- Transparente Festpreise – kein böses Erwachen am Ende
- Spezialisiert auf lokale Betriebe und Handwerk
- Persönlicher Ansprechpartner (Marc Daub) – keine anonyme Agentur

QUALIFIZIERUNG:
- Frage früh: "Haben Sie bereits eine Website?" → empfehle passendes Paket
- Frage nach Branche wenn relevant → persönlichere Empfehlung

LEAD-ERFASSUNG:
- Wenn der Besucher konkretes Interesse zeigt, frage nach Name und E-Mail
- Sage genau: "Darf ich kurz Ihren Namen und Ihre E-Mail notieren? Dann meldet sich Marc persönlich bei Ihnen."
- Wenn du Name und E-Mail hast, antworte mit diesem exakten Format am Ende: [LEAD:name=NAME,email=EMAIL]

Wichtige Regeln:
- Antworte IMMER auf Deutsch
- Freundlich, kompetent, auf den Punkt (max. 5 Sätze)
- Bei konkretem Interesse immer Kontakt zu Marc empfehlen
- Keine erfundenen Informationen`;

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
