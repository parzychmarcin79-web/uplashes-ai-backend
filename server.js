require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

// MULTER (upload zdjęć)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const PORT = process.env.PORT || 10000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===============================================
// Helper – extract text
// ===============================================
function extractTextFromResponse(resp) {
  try {
    if (resp.output_text) return resp.output_text.trim();

    let chunks = [];
    if (resp.output) {
      for (const item of resp.output) {
        if (!item.content) continue;
        for (const c of item.content) {
          if (typeof c.text === "string") chunks.push(c.text);
          if (Array.isArray(c.text)) {
            for (const t of c.text) if (t.text) chunks.push(t.text);
          }
        }
      }
    }
    return chunks.join("\n").trim();
  } catch (e) {
    return "";
  }
}

// ===============================================
// PROMPT – analiza zdjęcia
// ===============================================
const systemPrompt = `
Jesteś ekspertem UPLashes AI. Analizujesz stylizację rzęs na zdjęciu.
Odpowiadasz po polsku. Jeśli na zdjęciu nie ma oka z bliska — napisz:
"Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
`;

// ===============================================
// ENDPOINT: HEALTH CHECK
// ===============================================
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa");
});

// ===============================================
// ENDPOINT: /analyze
// ===============================================
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Brak zdjęcia." });
    }

    const base64 = req.file.buffer.toString("base64");

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: systemPrompt },
            { type: "input_image", image_url: `data:image/jpeg;base64,${base64}` },
          ],
        },
      ],
    });

    const analysis = extractTextFromResponse(openaiResponse) || "Model nie zwrócił raportu.";

    res.json({ success: true, analysis });
  } catch (e) {
    console.error("Błąd /analyze:", e);
    res.status(500).json({ success: false, error: "Błąd serwera." });
  }
});

// ===============================================
// ENDPOINT: BEFORE/AFTER
// ===============================================
function buildBeforeAfterPrompt() {
  return `
Jesteś ekspertem UPLashes AI. Porównaj zdjęcia BEFORE i AFTER.
Pisz po polsku.
`;
}

app.post("/api/analyze-before-after", async (req, res) => {
  try {
    const { beforeImage, afterImage } = req.body;

    if (!beforeImage || !afterImage) {
      return res.status(400).json({ error: "Brak zdjęć." });
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

    const text = extractTextFromResponse(openaiResponse) || "Brak szczegółowego raportu.";

    res.json({ analysisText: text });
  } catch (e) {
    console.error("Błąd BEFORE/AFTER:", e);
    res.status(500).json({ error: "Błąd serwera." });
  }
});

// ===============================================
// ENDPOINT: /generate-map  (TEXT MAP)
// ===============================================
app.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Brak zdjęcia." });
    }

    const imageBase64 = req.file.buffer.toString("base64");

    const ai = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: "Zwróć tylko jedną linię w formacie: MAPA: 8-9-10-11-12-11-10-9-8",
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Wygeneruj mapkę na podstawie zdjęcia." },
            { type: "input_image", image_url: `data:image/jpeg;base64,${imageBase64}` },
          ],
        },
      ],
    });

    const raw = extractTextFromResponse(ai) || "MAPA: 8-9-10-11-12-11-10-9-8";
    const match = raw.match(/MAPA:\s*([0-9\-]+)/i);
    const mapLine = match ? match[1] : "";

    res.json({ success: true, map: raw, mapLine });
  } catch (e) {
    console.error("Błąd /generate-map:", e);
    res.status(500).json({ success: false, error: "Błąd generowania mapy." });
  }
});

// ===============================================
// ENDPOINT: /generate-lash-map (STATIC SVG)
// ===============================================
app.post("/generate-lash-map", async (req, res) => {
  try {
    const svg = `
<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="260" viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="260" fill="#f9f7f3"/>
  <text x="300" y="40" text-anchor="middle" font-size="18" fill="#444">MAPKA RZĘS UPLashes</text>

  <path d="M40 160 Q300 40 560 160" stroke="#c0b283" stroke-width="3" fill="none"/>

  <g font-size="12" fill="#444">
    <circle cx="70" cy="150" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="70" y="154" text-anchor="middle">1</text>

    <circle cx="130" cy="130" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="130" y="134" text-anchor="middle">2</text>

    <circle cx="190" cy="115" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="190" y="119" text-anchor="middle">3</text>

    <circle cx="250" cy="100" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="250" y="104" text-anchor="middle">4</text>

    <circle cx="310" cy="95" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="310" y="99" text-anchor="middle">5</text>

    <circle cx="370" cy="100" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="370" y="104" text-anchor="middle">6</text>

    <circle cx="430" cy="115" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="430" y="119" text-anchor="middle">7</text>

    <circle cx="490" cy="130" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="490" y="134" text-anchor="middle">8</text>

    <circle cx="550" cy="150" r="14" stroke="#c0b283" stroke-width="2" fill="#fff"/>
    <text x="550" y="154" text-anchor="middle">9</text>
  </g>

  <text x="70" y="190" text-anchor="middle" font-size="11" fill="#666">Wewnętrzny kącik</text>
  <text x="550" y="190" text-anchor="middle" font-size="11" fill="#666">Zewnętrzny kącik</text>
</svg>
`;

    const base64 = Buffer.from(svg).toString("base64");

    res.json({
      success: true,
      imageUrl: `data:image/svg+xml;base64,${base64}`,
    });
  } catch (e) {
    console.error("Błąd SVG:", e);
    res.status(500).json({ success: false, error: "Błąd SVG" });
  }
});

// ===============================================
// START SERVERA
// ===============================================
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
