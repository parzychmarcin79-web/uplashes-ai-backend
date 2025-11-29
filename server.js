require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json());

// ---------- MULTER (upload zdjęcia) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

const PORT = process.env.PORT || 10000;

// ---------- KLIENT OPENAI ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- HELPER: wyciąganie tekstu z odpowiedzi OpenAI ----------
function extractTextFromResponse(resp) {
  try {
    if (!resp) return "";

    // Nowe API – czasem ma output_text
    if (typeof resp.output_text === "string") {
      const t = resp.output_text.trim();
      if (t) return t;
    }

    const chunks = [];

    if (Array.isArray(resp.output)) {
      for (const item of resp.output) {
        if (!item || !Array.isArray(item.content)) continue;

        for (const part of item.content) {
          if (!part) continue;

          if (Array.isArray(part.text)) {
            for (const t of part.text) {
              if (t && typeof t.text === "string") chunks.push(t.text);
            }
          } else if (typeof part.text === "string") {
            chunks.push(part.text);
          } else if (typeof part.output_text === "string") {
            chunks.push(part.output_text);
          }
        }
      }
    }

    const joined = chunks.join("\n\n").trim();
    return joined;
  } catch (e) {
    console.error("extractTextFromResponse error", e);
    return "";
  }
}

// ---------- PROMPTY ----------

// Raport dla jednego oka
const systemPromptAnalyze = `
Jesteś ekspertem UPLashes AI do zaawansowanej analizy stylizacji rzęs na zdjęciach.

- Analizujesz jedno oko (jedną powiekę) na zdjęciu.
- Oceniasz tylko to, co realnie widzisz.
- Odpowiedź po polsku, krótki raport w formacie Markdown z sekcjami:
  1. Ocena zdjęcia i rodzaju rzęs
  2. Typ stylizacji
  3. Analiza techniczna (gęstość, kierunek, mapowanie, sklejenia, odrosty, klej)
  4. Jakość wachlarzy (jeśli volume/mega)
  5. Tryb Anime / Spike (jeśli dotyczy)
  6. Najważniejsze wskazówki (3–5 punktów).
`;

// Raport BEFORE / AFTER
function buildBeforeAfterPrompt() {
  return `
Jesteś ekspertem UPLashes AI.

Porównaj zdjęcia BEFORE (przed) i AFTER (po) jednej klientki.
Oceń, co się poprawiło, co można dopracować.
Odpowiadasz po polsku, w krótkim raporcie Markdown.`;
}

// ===================================================
//               PODSTAWOWE ENDPOINTY
// ===================================================

app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "Backend UPLashes AI odpowiada na /ping" });
});

// ===================================================
//                    /analyze
//     (analiza jednego zdjęcia oka)
// ===================================================

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia w polu 'image'.",
      });
    }

    const base64 = req.file.buffer.toString("base64");

    const oaResp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: systemPromptAnalyze },
            {
              type: "input_image",
              image_url: `data:${req.file.mimetype};base64,${base64}`,
            },
          ],
        },
      ],
    });

    let analysis =
      extractTextFromResponse(oaResp) ||
      "Model nie zwrócił szczegółowego raportu.";

    res.json({ success: true, analysis });
  } catch (err) {
    console.error("/analyze error", err);
    res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
      details: err.message || String(err),
    });
  }
});

// ===================================================
//            /api/analyze-before-after
//     (porównanie dwóch zdjęć – BEFORE/AFTER)
// ===================================================

app.post("/api/analyze-before-after", async (req, res) => {
  try {
    const { beforeImage, afterImage } = req.body || {};

    if (!beforeImage || !afterImage) {
      return res.status(400).json({
        error: "Both beforeImage and afterImage are required.",
      });
    }

    const prompt = buildBeforeAfterPrompt();

    const oaResp = await client.responses.create({
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

    let text =
      extractTextFromResponse(oaResp) ||
      "Model nie zwrócił szczegółowego raportu dla porównania BEFORE/AFTER.";

    res.json({ analysisText: text });
  } catch (err) {
    console.error("/api/analyze-before-after error", err);
    res.status(500).json({
      error: "Błąd serwera podczas analizy BEFORE/AFTER.",
      details: err.message || String(err),
    });
  }
});

// ===================================================
//                   /generate-map
//    (tekstowa MAPA: 8-9-10-11-12-11-10-9-8 z obrazu)
// ===================================================

app.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia do wygenerowania mapki.",
      });
    }

    const base64 = req.file.buffer.toString("base64");

    const mapPrompt = `
Na podstawie zdjęcia oka z założonymi rzęsami zaproponuj mapkę długości.
Zwróć jedną linijkę w dokładnym formacie:
MAPA: 8-9-10-11-12-11-10-9-8
(zapisz tylko jedną linię, bez dodatkowego tekstu).`;

    const oaResp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: mapPrompt },
            {
              type: "input_image",
              image_url: `data:${req.file.mimetype};base64,${base64}`,
            },
          ],
        },
      ],
    });

    const rawText =
      extractTextFromResponse(oaResp) || "MAPA: 8-9-10-11-12-11-10-9-8";

    const m = rawText.match(/MAPA:\s*([0-9\s\-]+)/i);
    const mapLine = m ? m[1].trim() : "8-9-10-11-12-11-10-9-8";

    res.json({ success: true, map: `MAPA: ${mapLine}`, mapLine });
  } catch (err) {
    console.error("/generate-map error", err);
    res.status(500).json({
      success: false,
      error: "Błąd po stronie serwera podczas generowania mapy.",
    });
  }
});

// ===================================================
//             /generate-lash-map (statyczne SVG)
//       (białe tło, szkoleniowa karta mappingowa)
// ===================================================

app.post("/generate-lash-map", async (req, res) => {
  try {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="260" viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="600" height="260" fill="#ffffff"/>
  <text x="50%" y="40" text-anchor="middle" font-family="system-ui" font-size="18" fill="#111827">
    Mapka rzęs • UPLashes
  </text>
  <text x="50%" y="60" text-anchor="middle" font-family="system-ui" font-size="11" fill="#6b7280">
    Styl szkoleniowy – białe tło
  </text>

  <path d="M 40 180 Q 300 60 560 180" fill="none" stroke="#d1d5db" stroke-width="2"/>
  <path d="M 40 210 Q 300 90 560 210" fill="none" stroke="#9ca3af" stroke-width="2"/>

  <g font-family="system-ui" font-size="12" fill="#374151">
    <circle cx="70"  cy="185" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="70"  y="189" text-anchor="middle">1</text>

    <circle cx="130" cy="170" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="130" y="174" text-anchor="middle">2</text>

    <circle cx="190" cy="155" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="190" y="159" text-anchor="middle">3</text>

    <circle cx="250" cy="140" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="250" y="144" text-anchor="middle">4</text>

    <circle cx="310" cy="135" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="310" y="139" text-anchor="middle">5</text>

    <circle cx="370" cy="140" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="370" y="144" text-anchor="middle">6</text>

    <circle cx="430" cy="155" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="430" y="159" text-anchor="middle">7</text>

    <circle cx="490" cy="170" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="490" y="174" text-anchor="middle">8</text>

    <circle cx="550" cy="185" r="13" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
    <text x="550" y="189" text-anchor="middle">9</text>
  </g>

  <text x="40"  y="230" text-anchor="start" font-size="11" font-family="system-ui" fill="#6b7280">
    Wewnętrzny kącik
  </text>
  <text x="560" y="230" text-anchor="end" font-size="11" font-family="system-ui" fill="#6b7280">
    Zewnętrzny kącik
  </text>
</svg>`;

    const base64 = Buffer.from(svg, "utf8").toString("base64");
    res.json({
      success: true,
      imageUrl: `data:image/svg+xml;base64,${base64}`,
    });
  } catch (err) {
    console.error("/generate-lash-map error", err);
    res.status(500).json({
      success: false,
      error: "Błąd generowania mapki graficznej (SVG).",
    });
  }
});

// ===================================================
//                 START SERWERA
// ===================================================

app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
