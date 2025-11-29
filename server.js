// server.js – UPLashes AI (analiza + mapa rzęs)

const express = require("express");
const cors = require("cors");

const app = express();

// Ustawienia podstawowe
app.use(cors());
app.use(express.json({ limit: "10mb" })); // JSON + duże zdjęcia base64

// PORT – Render ustawia PORT w env
const PORT = process.env.PORT || 10000;

// Wszystkie skręty UPLashes używane w mapie
// Jak chcesz zmienić – edytuj tylko tę tablicę:
const UPLASHES_CURLS = ["C", "CC", "D", "DD", "L", "M"];

// Sprawdzenie klucza OpenAI
function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");
    return false;
  }
  return true;
}

// Pomocnicza funkcja do wywołania OpenAI Chat Completions
async function callOpenAI(messages, temperature = 0.4) {
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

// Pomocniczo – oczyszczenie stringa z JSON (usuwa ```json ... ```)
function cleanJsonString(str) {
  if (!str) return str;
  return str
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

// Zamiana struktury inner/transition/central/outer -> tablica zones[]
function mapToZones(mapObj) {
  if (!mapObj || typeof mapObj !== "object") return null;

  const inner = mapObj.inner || {};
  const transition = mapObj.transition || {};
  const central = mapObj.central || {};
  const outer = mapObj.outer || {};

  const zones = [
    {
      zone: inner.zone || "0–20%",
      lengths: inner.lengths || "7–8",
      curlMain: inner.curl || "CC",
      curlsAll: UPLASHES_CURLS,
      note: inner.note || "",
    },
    {
      zone: transition.zone || "20–40%",
      lengths: transition.lengths || "9–10",
      curlMain: transition.curl || "CC",
      curlsAll: UPLASHES_CURLS,
      note: transition.note || "",
    },
    {
      zone: central.zone || "40–70%",
      lengths: central.lengths || "10–11–12",
      curlMain: central.curl || "CC",
      curlsAll: UPLASHES_CURLS,
      note: central.note || "",
    },
    {
      zone: outer.zone || "70–100%",
      lengths: outer.lengths || "11–12–13",
      curlMain: outer.curl || "C",
      curlsAll: UPLASHES_CURLS,
      note: outer.note || "",
    },
  ];

  return zones;
}

// Domyślna mapa – używana awaryjnie, jeśli JSON z AI nie przejdzie
function getFallbackZones() {
  return [
    {
      zone: "0–20%",
      lengths: "8–9",
      curlMain: "CC",
      curlsAll: UPLASHES_CURLS,
      note: "delikatny początek, miękkie otwarcie",
    },
    {
      zone: "20–40%",
      lengths: "9–10",
      curlMain: "CC",
      curlsAll: UPLASHES_CURLS,
      note: "łagodne budowanie efektu",
    },
    {
      zone: "40–70%",
      lengths: "10–11–12",
      curlMain: "D",
      curlsAll: UPLASHES_CURLS,
      note: "główne otwarcie oka",
    },
    {
      zone: "70–100%",
      lengths: "11–12–13",
      curlMain: "C",
      curlsAll: UPLASHES_CURLS,
      note: "delikatne wyciągnięcie bez obciążania rzęs",
    },
  ];
}

// ─────────────────────────────────────────────
//  ROUTE 1 – root / (health check Render)
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "analyze+lash-map",
    message: "UPLashes AI – backend działa poprawnie.",
  });
});

// ─────────────────────────────────────────────
//  ROUTE 2 – /status (prosty ping z frontu)
// ─────────────────────────────────────────────
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "analyze+lash-map",
    version: "1.2.0",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
//  ROUTE 3 – /analyze – analiza zdjęcia
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

    const system =
      lang === "en"
        ? "You are an expert lash stylist. Analyse the uploaded eye/lash photo and give a clear, practical description for a lash tech. Focus on density, direction, mapping, lash health, and key tips to improve the result. Be specific but concise."
        : "Jesteś ekspertem od stylizacji rzęs. Analizujesz przesłane zdjęcie oka/rzęs i tworzysz przejrzysty, praktyczny opis dla stylistki rzęs. Skup się na: gęstości, kierunku, mapowaniu, kondycji rzęs oraz kluczowych wskazówkach jak poprawić efekt. Pisz konkretnie, ale zwięźle.";

    const userText =
      lang === "en"
        ? "Here is the client photo. Please analyse the lash work and give your professional feedback."
        : "To jest zdjęcie pracy na rzęsach klientki. Przeanalizuj stylizację i opisz swoje profesjonalne wnioski.";

    const messages = [
      { role: "system", content: system },
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

    const text = await callOpenAI(messages, 0.4);

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
//  ROUTE 4 – /lash-map – mapa rzęs z AI
// ─────────────────────────────────────────────
app.post("/lash-map", async (req, res) => {
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
        ? `You are a lash styling expert. Based on the uploaded eye/lash photo, you propose a detailed lash map for one eye.

Return ONLY valid JSON in this exact format (no extra text):

{
  "map": {
    "inner": {
      "zone": "0-20%",
      "lengths": "7-8",
      "curl": "CC",
      "note": "short, soft opening"
    },
    "transition": {
      "zone": "20-40%",
      "lengths": "9-10",
      "curl": "CC",
      "note": "smooth build-up"
    },
    "central": {
      "zone": "40-70%",
      "lengths": "10-11-12",
      "curl": "CC",
      "note": "main opening"
    },
    "outer": {
      "zone": "70-100%",
      "lengths": "11-12-13",
      "curl": "C",
      "note": "gentle elongation without heaviness"
    }
  }
}

Rules:
- Use lengths that make sense for the eye in the photo.
- Keep notes short (max 1 sentence each).
- Write all text in English.`
        : `Jesteś ekspertem od stylizacji rzęs. Na podstawie przesłanego zdjęcia oka/rzęs proponujesz szczegółową mapę rzęs dla jednego oka.

Zwróć TYLKO poprawny JSON w dokładnie takim formacie (bez dodatkowego tekstu):

{
  "map": {
    "inner": {
      "zone": "0-20%",
      "lengths": "7-8",
      "curl": "CC",
      "note": "delikatny początek, miękkie otwarcie"
    },
    "transition": {
      "zone": "20-40%",
      "lengths": "9-10",
      "curl": "CC",
      "note": "łagodne budowanie efektu"
    },
    "central": {
      "zone": "40-70%",
      "lengths": "10-11-12",
      "curl": "CC",
      "note": "główne otwarcie oka"
    },
    "outer": {
      "zone": "70-100%",
      "lengths": "11-12-13",
      "curl": "C",
      "note": "delikatne wyciągnięcie bez obciążania rzęs"
    }
  }
}

Zasady:
- Dobierz długości do kształtu oka na zdjęciu.
- Notatki maksymalnie jedno zdanie.
- Cały tekst po polsku.`;

    const userText =
      lang === "en"
        ? "Create a lash map for this eye. Remember: respond ONLY with JSON in the required format."
        : "Stwórz mapę rzęs dla tego oka. Pamiętaj: odpowiedz TYLKO w formacie JSON jak w przykładzie.";

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

    const rawContent = await callOpenAI(messages, 0.3);
    const cleaned = cleanJsonString(rawContent);

    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Nie udało się sparsować JSON z /lash-map:", e, cleaned);
    }

    // Jeśli udało się sparsować i jest map
    if (parsed && parsed.map) {
      const zones = mapToZones(parsed.map) || getFallbackZones();

      return res.status(200).json({
        status: "success",
        map: {
          zones,
        },
        raw: cleaned,
      });
    }

    // Awaryjnie – jeśli JSON z AI jest rozwalony, ale chcemy, żeby front miał mapę
    const fallbackZones = getFallbackZones();

    return res.status(200).json({
      status: "success",
      map: {
        zones: fallbackZones,
      },
      raw: cleaned || "",
    });
  } catch (error) {
    console.error("Błąd /lash-map:", error);
    res.status(500).json({
      status: "error",
      message: "Wystąpił błąd podczas generowania mapy rzęs.",
    });
  }
});

// ─────────────────────────────────────────────
//  START SERWERA
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
