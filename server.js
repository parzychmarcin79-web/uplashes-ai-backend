// UPLashes AI – backend analizy zdjęć rzęs

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

// ---------------------------------------
// Konfiguracja podstawowa
// ---------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

const PORT = process.env.PORT || 10000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------------------------------
// Helper – wyciąganie tekstu z Responses API
// ---------------------------------------
function extractTextFromResponse(resp) {
  try {
    if (resp && typeof resp.output_text === "string") {
      const t = resp.output_text.trim();
      if (t) return t;
    }

    const chunks = [];

    if (resp && Array.isArray(resp.output)) {
      for (const item of resp.output) {
        if (!item || !Array.isArray(item.content)) continue;

        for (const part of item.content) {
          if (!part) continue;

          if (typeof part.text === "string") {
            chunks.push(part.text);
          } else if (Array.isArray(part.text)) {
            for (const t of part.text) {
              if (t && typeof t.text === "string") {
                chunks.push(t.text);
              }
            }
          } else if (typeof part.output_text === "string") {
            chunks.push(part.output_text);
          }
        }
      }
    }

    const joined = chunks.join("\n\n").trim();
    return joined;
  } catch (e) {
    console.error("extractTextFromResponse error:", e);
    return "";
  }
}

// ---------------------------------------
// Prompty
// ---------------------------------------
const systemPromptAnalyze = `
Jesteś ekspertem UPLashes AI do zaawansowanej analizy stylizacji rzęs na zdjęciach.
Odpowiadasz po polsku, profesjonalnie, ale prosto.

Jeśli NA ZDJĘCIU NIE MA oka z rzęsami z bliska:
napisz TYLKO:
"Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."

Jeśli wszystko widać dobrze – przygotuj raport AI.UPLashes w punktach:
- czy to naturalne rzęsy czy aplikacja,
- typ stylizacji (klasyka, light volume, volume, mega volume, anime/spike lub inny),
- gęstość i pokrycie linii rzęs,
- kierunek i ustawienie,
- separacja i sklejenia,
- odrosty,
- ilość kleju,
- 3–5 najważniejszych wskazówek dla stylistki.
`;

function buildBeforeAfterPrompt() {
  return `
Jesteś ekspertem UPLashes AI.

Porównujesz dwa zdjęcia rzęs: BEFORE (przed) i AFTER (po).
Oceniasz:
- co było problemem na BEFORE,
- co się poprawiło na AFTER,
- co nadal można ulepszyć.

Odpowiedź po polsku w formie krótkiego raportu w punktach.
`;
}

// ---------------------------------------
// HEALTHCHECK
// ---------------------------------------
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "UPLashes AI backend odpowiada na /ping" });
});

// ---------------------------------------
// /analyze – jedno zdjęcie oka
// ---------------------------------------
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia (pole 'image').",
      });
    }

    const base64Image = req.file.buffer.toString("base64");

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: systemPromptAnalyze },
            {
              type: "input_image",
              image_url: `data:${req.file.mimetype};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    const analysis =
      extractTextFromResponse(openaiResponse) ||
      "Model nie zwrócił szczegółowego raportu.";

    res.json({ success: true, analysis });
  } catch (error) {
    console.error("Błąd w /analyze:", error);
    res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
    });
  }
});

// ---------------------------------------
// /api/analyze-before-after – 2 zdjęcia (base64)
// ---------------------------------------
app.post("/api/analyze-before-after", async (req, res) => {
  try {
    const { beforeImage, afterImage } = req.body || {};

    if (!beforeImage || !afterImage) {
      return res.status(400).json({
        error: "Both beforeImage and afterImage are required.",
      });
    }

    const prompt = buildBeforeAfterPrompt();

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: beforeImage },
            { type: "input_image", image_url: afterImage },
          ],
        },
      ],
    });

    const text =
      extractTextFromResponse(openaiResponse) ||
      "Model nie zwrócił szczegółowego raportu dla porównania BEFORE/AFTER.";

    res.json({ analysisText: text });
  } catch (error) {
    console.error("Błąd w /api/analyze-before-after:", error);
    res.status(500).json({
      error: "Błąd serwera podczas analizy BEFORE/AFTER.",
    });
  }
});

// ---------------------------------------
// /generate-map – tekstowa mapka z linii "MAPA: 8-9-10-..."
// (analiza na podstawie zdjęcia oka)
// ---------------------------------------
app.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia do analizy.",
      });
    }

    const lang = (req.body && req.body.language) || "pl";
    const base64Image = req.file.buffer.toString("base64");

    const prompt =
      lang === "en"
        ? `You are a lash mapping expert. Based on the eye photo, propose a lash map.
Write a short description and INCLUDE ONE LINE with lengths in mm in the format:
MAPA: 8-9-10-11-12-11-10-9-8
Use exactly the word "MAPA:" at the beginning of that line.`
        : `Jesteś ekspertem od mapek rzęs. Na podstawie zdjęcia oka zaproponuj mapkę.
Napisz krótki opis po polsku i KONIECZNIE dodaj JEDNĄ linię z długościami w mm
w formacie:
MAPA: 8-9-10-11-12-11-10-9-8
Użyj dokładnie słowa "MAPA:" na początku tej linii.`;

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: `data:${req.file.mimetype};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    const rawText =
      extractTextFromResponse(openaiResponse) ||
      "MAPA: 8-9-10-11-12-11-10-9-8";

    const mapLineMatch = rawText.match(/MAPA:\s*([0-9\s\-]+)/i);
    const mapLine = mapLineMatch ? mapLineMatch[1].trim() : "";

    res.json({
      success: true,
      map: rawText,
      mapLine,
    });
  } catch (err) {
    console.error("Błąd /generate-map:", err);
    res.status(500).json({
      success: false,
      error: "Błąd po stronie serwera podczas generowania mapy.",
    });
  }
});

// ---------------------------------------
// /generate-lash-map – statyczna karta mappingowa (SVG, styl szkoleniowy B)
// (frontend używa tego tylko do obrazka, BEZ OpenAI)
// ---------------------------------------
app.post("/generate-lash-map", async (req, res) => {
  try {
    const svg = `
<?xml version="1.0" encoding="UTF-8"?>
<svg width="620" height="260" viewBox="0 0 620 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="620" height="260" fill="#ffffff"/>
  <text x="310" y="30" text-anchor="middle" font-family="system-ui" font-size="18" fill="#111827">
    Mapka rzęs • UPLashes
  </text>
  <text x="310" y="48" text-anchor="middle" font-family="system-ui" font-size="11" fill="#6b7280">
    Styl B – białe tło, karta mappingowa
  </text>

  <path d="M 90 190 A 220 220 0 0 1 530 190" fill="none" stroke="#e5e7eb" stroke-width="1.6"/>
  <path d="M 90 230 A 220 220 0 0 1 530 230" fill="none" stroke="#9ca3af" stroke-width="1.8"/>

  <g font-family="system-ui" font-size="11" fill="#374151">
    <text x="120" y="120" text-anchor="middle">7 mm</text>
    <text x="170" y="105" text-anchor="middle">8 mm</text>
    <text x="220" y="95" text-anchor="middle">9 mm</text>
    <text x="270" y="90" text-anchor="middle">10 mm</text>
    <text x="320" y="88" text-anchor="middle">11 mm</text>
    <text x="370" y="90" text-anchor="middle">10 mm</text>
    <text x="420" y="95" text-anchor="middle">9 mm</text>
    <text x="470" y="105" text-anchor="middle">8 mm</text>
    <text x="520" y="120" text-anchor="middle">7 mm</text>
  </g>

  <g font-family="system-ui" font-size="11" fill="#6b7280">
    <text x="120" y="210" text-anchor="middle">1</text>
    <text x="170" y="210" text-anchor="middle">2</text>
    <text x="220" y="210" text-anchor="middle">3</text>
    <text x="270" y="210" text-anchor="middle">4</text>
    <text x="320" y="210" text-anchor="middle">5</text>
    <text x="370" y="210" text-anchor="middle">6</text>
    <text x="420" y="210" text-anchor="middle">7</text>
    <text x="470" y="210" text-anchor="middle">8</text>
    <text x="520" y="210" text-anchor="middle">9</text>
  </g>

  <text x="90" y="248" text-anchor="start" font-family="system-ui" font-size="11" fill="#6b7280">
    Wewnętrzny kącik
  </text>
  <text x="530" y="248" text-anchor="end" font-family="system-ui" font-size="11" fill="#6b7280">
    Zewnętrzny kącik
  </text>
</svg>
`;

    const base64 = Buffer.from(svg, "utf8").toString("base64");

    res.json({
      success: true,
      imageUrl: `data:image/svg+xml;base64,${base64}`,
    });
  } catch (err) {
    console.error("Błąd generowania mapki (SVG):", err);
    res.status(500).json({
      success: false,
      error: "Błąd generowania mapki graficznej (SVG).",
    });
  }
});

// ---------------------------------------
// START SERWERA
// ---------------------------------------
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
