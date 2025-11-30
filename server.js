// server.js – UPLashes – analiza stylizacji rzęs (PRO wersja raportu)

const express = require("express");
const cors = require("cors");

const app = express();

// Podstawowe middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // JSON + duże zdjęcia base64

// Port – przy deployu na Render PORT jest brany z env
const PORT = process.env.PORT || 10000;

// Sprawdzenie klucza OpenAI
function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");
    return false;
  }
  return true;
}

// Pomocnicza funkcja do wywołania OpenAI Chat Completions
async function callOpenAI(messages, temperature = 0.5) {
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
    const errText = await response.text().catch(() => "");
    console.error("Błąd OpenAI:", response.status, errText);
    throw new Error("OpenAI zwróciło błąd");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content.trim();
}

// ─────────────────────────────────────────────
//  ROUTE 1 – root / (health check dla Render)
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "uplashes-analyze",
    message: "UPLashes – backend analizy działa poprawnie.",
  });
});

// ─────────────────────────────────────────────
//  ROUTE 2 – /status (ping z frontu)
// ─────────────────────────────────────────────
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "uplashes-analyze",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
//  ROUTE 3 – /analyze – analiza zdjęcia rzęs
// ─────────────────────────────────────────────
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

    const systemPrompt =
      lang === "en"
        ? `
You are a highly experienced lash stylist and trainer working for the UPLashes brand.
Your task is to analyse ONE uploaded photo of an eye/lash set and write a **clear, professional report** for a lash tech.

Requirements:
- Always respond **in English**.
- Treat every photo as unique – avoid reusing identical sentences from one analysis to another.
- Be specific, practical and kind – this is feedback, not criticism.
- Do NOT invent what is not visible in the picture.

Structure your answer in sections with short paragraphs and bullet points where helpful:

1. Density & Coverage  
   - Describe overall density, evenness of coverage, visible gaps.

2. Direction & Mapping  
   - Comment on direction, symmetry, and how the lash map looks on the eye shape.

3. Application Quality  
   - Isolating, attachment area, bases, wrapping, stickies, glue control.

4. Natural Lashes Condition  
   - Visible health of naturals, tension, any signs of overload or stress.

5. Retention & Safety Tips  
   - 3–6 practical tips to improve durability and safety (humidity, glue placement, layer work, weight choice etc.).

6. Styling Suggestions  
   - Suggest what could be adjusted next time (e.g. lengths, curls, thickness, zones) to flatter this eye shape.

Keep the whole report around 250–450 words, but make it feel customised to THIS photo.`
        : `
Jesteś doświadczoną instruktorką stylizacji rzęs pracującą dla marki UPLashes.
Twoim zadaniem jest przeanalizować JEDNO przesłane zdjęcie oka / stylizacji rzęs
i przygotować **czytelny, profesjonalny raport** dla stylistki.

Wymagania:
- Zawsze odpowiadaj **po polsku**.
- Traktuj każde zdjęcie jako unikalne – unikaj powtarzania identycznych zdań między analizami.
- Bądź konkretna, praktyczna i wspierająca – to ma być feedback, a nie hejt.
- Nie wymyślaj rzeczy, których nie widać na zdjęciu.

Ułóż odpowiedź w sekcje, z krótkimi akapitami, a tam gdzie pasuje – w punktach:

1. Gęstość i pokrycie linii rzęs  
   - Opisz ogólną gęstość, równomierność, ewentualne przerwy.

2. Kierunek i mapowanie  
   - Jak wygląda kierunek rzęs, symetria, dopasowanie mapy do kształtu oka.

3. Jakość aplikacji  
   - Separacja, miejsce przyklejenia, podstawy rzęs, ewentualne sklejenia, kontrola kleju.

4. Kondycja rzęs naturalnych  
   - Widoczny stan naturalsów, napięcia, czy nie są przeciążone.

5. Retencja i bezpieczeństwo – wskazówki  
   - 3–6 praktycznych tipów jak poprawić trwałość i bezpieczeństwo (wilgotność, praca warstwowa, dobór grubości, klej itd.).

6. Propozycje stylizacji na przyszłość  
   - Co można zmienić przy kolejnej aplikacji (długości, skręty, strefy), żeby lepiej podkreślić to oko.

Cały raport utrzymaj w granicach 250–450 słów, ale tak, aby był wyraźnie dopasowany do TEGO konkretnego zdjęcia.`;

    const userText =
      lang === "en"
        ? "Here is the lash set photo. Analyse it and write the report in the structure described above."
        : "To jest zdjęcie stylizacji rzęs. Przeanalizuj je i napisz raport w strukturze opisanej w instrukcji.";

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

    const text = await callOpenAI(messages, 0.55);

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

// ─────────────────────────────────────────────
//  START SERWERA
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`UPLashes – backend analizy działa na porcie ${PORT}`);
});
