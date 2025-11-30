const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// PORT z Render
const PORT = process.env.PORT || 10000;

// Sprawdzenie klucza
function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");
    return false;
  }
  return true;
}

// Pomocnicza funkcja do wywołania OpenAI
async function callOpenAI(messages, temperature = 0.45) {
  if (!ensureApiKey()) {
    throw new Error("Brak klucza OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Błąd OpenAI:", response.status, errText);
    throw new Error("OpenAI zwróciło błąd");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content.trim();
}

/* ─────────────────────────────
   1. Root + status
───────────────────────────── */

app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "uplashes-analyze",
    message: "UPLashes – backend analizy stylizacji rzęs działa.",
  });
});

app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "uplashes-analyze",
    version: "1.2.0",
    timestamp: new Date().toISOString(),
  });
});

/* ─────────────────────────────
   2. /analyze – główna analiza zdjęcia
───────────────────────────── */

app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, language } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Brakuje danych zdjęcia (imageBase64).",
      });
    }

    const lang = language === "en" ? "en" : "pl";

    // PROMPT PL / EN – styl PRO instruktorki UPLashes
    const systemPrompt =
      lang === "en"
        ? `
You are an experienced lash trainer and salon owner specialising in high-quality work (brand style: UPLashes).
You analyse ONE uploaded eye / lash photo and write a professional report **for another lash stylist** (not for the client).

The report must be:
- precise, technical, but still easy to read,
- written in clear, modern language (no generic AI phrases, no apologies),
- different in wording for each photo – DO NOT reuse the exact same sentences or generic intros.

STRUCTURE (keep this structure in every report):

1. Short overall assessment – 1–2 sentences.
   - What type of effect do you see (natural / stronger / very intense)?
   - Does the work generally look clean and safe?

2. Strengths of the set (bullet points).
   - 3–5 bullet points.
   - Each bullet: a short title + quick explanation.
   - Focus on: direction, cleanliness, styling idea, mapping logic, suitability to eye shape.

3. Elements to improve (bullet points – very concrete).
   - 3–6 bullet points.
   - Each bullet must answer: WHAT is off + WHY it matters + HOW to fix it next time.
   - Talk about: attachment area, glue amount, direction inconsistency, lash layers, inner/outer corners, mapping balance, weight vs natural lashes, isolation.

4. Technical recommendations.
   - 3–6 short points with practical tips:
     - example lengths for inner / central / outer zone,
     - suggestions about curl (C/CC/D etc.) and thickness,
     - what to change in mapping or weight for better balance and retention,
     - tips about working cleaner around the lash line and using less/more adhesive if needed.

5. Educational tip to close.
   - 1 sentence with a small coaching tip for the stylist (e.g. how to practise, what to observe more carefully next time).
   - Motivating, not judging.

Additional rules:
- Write everything in **English**.
- Do NOT mention “AI”, “as an AI model”, etc.
- Do NOT invent brand/product promotion – focus purely on technique.
- If something is not perfectly visible on the photo, be careful and use words like "probably / seems / most likely".
`
        : `
Jesteś doświadczoną instruktorką stylizacji rzęs i właścicielką marki w stylu UPLashes.
Analizujesz JEDNO zdjęcie oka / rzęs i przygotowujesz profesjonalny raport
**dla innej stylistki rzęs** (nie dla klientki).

Raport ma być:
- konkretny, techniczny, ale czytelny,
- napisany nowoczesnym językiem (bez suchych, sztucznych zwrotów),
- za każdym razem nieco inaczej sformułowany – NIE powtarzaj w kółko tych samych zdań.

STRUKTURA (zachowuj ją w każdym raporcie):

1. Krótka ocena ogólna – 1–2 zdania.
   - Jaki efekt widzisz (naturalny / wyraźniejszy / bardzo mocny)?
   - Czy praca ogólnie wygląda czysto i bezpiecznie dla rzęs naturalnych?

2. Mocne strony stylizacji (wypunktowanie).
   - 3–5 punktów.
   - Każdy punkt: krótki nagłówek + krótkie wyjaśnienie.
   - Skup się na: kierunku, czystości pracy, pomyśle na stylizację, logice mapy, dopasowaniu do kształtu oka.

3. Elementy do poprawy (wypunktowanie – bardzo konkretne).
   - 3–6 punktów.
   - Każdy punkt ma odpowiadać na: CO jest do poprawy + DLACZEGO ma znaczenie + JAK to poprawić przy kolejnej aplikacji.
   - Porusz m.in.: miejsce przyklejenia, ilość kleju, kierunki, praca na warstwach, wewnętrzne i zewnętrzne kąciki, balans długości i gęstości, bezpieczeństwo dla rzęs naturalnych, izolację.

4. Rekomendacje techniczne.
   - 3–6 krótkich, praktycznych wskazówek:
     - przykładowe długości dla stref: 0–20%, 20–40%, 40–70%, 70–100%,
     - sugestie doboru skrętu (C / CC / D itd.) i grubości,
     - co zmienić w mapie lub objętości, żeby uzyskać lepszy balans oka i lepszą retencję,
     - jak pracować czyściej przy linii rzęs i jak kontrolować ilość kleju.

5. Tip edukacyjny na koniec.
   - 1 zdanie – mały coaching dla stylistki (np. jak ćwiczyć, na co zwracać uwagę).
   - Motywująco, bez oceniania.

Dodatkowe zasady:
- Pisz wszystko w **języku polskim**.
- Nie wspominaj, że jesteś modelem AI, nie przepraszaj.
- Nie wymyślaj konkretnej marki/produktów – skup się na TECHNICE.
- Jeśli coś na zdjęciu nie jest idealnie widoczne, używaj sformułowań typu
  „prawdopodobnie / wydaje się / najpewniej”.
`;

    const userText =
      lang === "en"
        ? "Here is the lash set photo. Analyse the work in detail and generate a structured, technical report for a lash stylist."
        : "To jest zdjęcie stylizacji rzęs. Przeanalizuj pracę szczegółowo i wygeneruj uporządkowany, techniczny raport dla stylistki.";

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      },
    ];

    const text = await callOpenAI(messages, 0.45);

    if (!text) {
      return res.status(500).json({
        status: "error",
        message: "AI nie zwróciło treści analizy.",
      });
    }

    res.status(200).json({
      status: "success",
      result: text,
    });
  } catch (error) {
    console.error("Błąd /analyze:", error);
    res.status(500).json({
      status: "error",
      message: "Wystąpił błąd podczas analizy zdjęcia.",
    });
  }
});

/* ─────────────────────────────
   3. Start serwera
───────────────────────────── */

app.listen(PORT, () => {
  console.log(`UPLashes – backend analizy działa na porcie ${PORT}`);
});
