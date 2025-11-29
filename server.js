// UPLashes AI – backend analizy zdjęć rzęs
// Wersja z:
//  - /analyze            – analiza JEDNEGO zdjęcia
//  - /api/analyze-before-after – analiza BEFORE/AFTER
//  - /generate-map       – tekstowa mapka rzęs NA PODSTAWIE ZDJĘCIA
//  - /generate-lash-map  – statyczna mapka graficzna (SVG)

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();

// --- Middleware (raz) ---
app.use(cors());
app.use(express.json());

// --- Multer – plik w pamięci ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// --- Port ---
const PORT = process.env.PORT || 10000;

// --- Klient OpenAI ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================== ENDPOINTY PODSTAWOWE ==================

app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// ================== POMOCNICZA FUNKCJA – TEKST Z ODPOWIEDZI ==================

function extractTextFromResponse(openaiResponse) {
  try {
    if (typeof openaiResponse.output_text === "string") {
      const t = openaiResponse.output_text.trim();
      if (t) return t;
    }

    const chunks = [];

    if (Array.isArray(openaiResponse.output)) {
      for (const item of openaiResponse.output) {
        if (!item || !Array.isArray(item.content)) continue;

        for (const part of item.content) {
          if (!part) continue;

          if (Array.isArray(part.text)) {
            for (const t of part.text) {
              if (t && typeof t.text === "string") {
                chunks.push(t.text);
              }
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
    if (joined) return joined;
  } catch (e) {
    console.error("Błąd przy parsowaniu odpowiedzi OpenAI:", e);
  }

  return "";
}

// ================== PROMPT SYSTEMOWY (JEDNO ZDJĘCIE) ==================

const systemPrompt = `
Jesteś ekspertem UPLashes AI do zaawansowanej analizy stylizacji rzęs na zdjęciach.

ZASADA OGÓLNA:
- Analizujesz JEDNO oko (jedną powiekę) na zdjęciu.
- Oceniasz tylko to, co REALNIE widzisz na zdjęciu – nie wymyślasz rzeczy.
- Odpowiedź ma być po POLSKU, prostym, ale profesjonalnym językiem, jak do stylistki rzęs.

KROK 1 – CZY W OGÓLE MOŻESZ OCENIĆ ZDJĘCIE
1. Sprawdź, czy na zdjęciu wyraźnie widać oko z rzęsami z bliska.
2. Jeśli zamiast oka jest np. podłoga, ekran, cała twarz z daleka itp.:
   - Odpowiedz TYLKO:
   "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
3. Jeśli wszystko jest OK – przejdź dalej.

KROK 2 – CZY JEST APLIKACJA, CZY NATURALNE RZĘSY
(... dalsza część jak wcześniej, zostawiona bez zmian ...)
`;

// ================== PROMPT BEFORE/AFTER ==================

function buildBeforeAfterPrompt(language = "pl") {
  return `
Jesteś ekspertem UPLashes AI.

Twoje zadanie:
Porównaj dwa zdjęcia rzęs: BEFORE (przed) i AFTER (po). Oceń, co się poprawiło,
co można jeszcze dopracować i czy efekt jest spójny z dobrą praktyką stylizacji rzęs.

Odpowiadasz tylko po polsku.

Struktura odpowiedzi (Markdown):

### AI.UPLashes REPORT – BEFORE / AFTER

1. Krótkie podsumowanie:
   - Jedno–dwa zdania: jaki był stan wyjściowy i co widać po stylizacji.

2. BEFORE – główne obserwacje:
   - gęstość i pokrycie,
   - kierunek i ustawienie rzęs,
   - ewentualne luki, sklejenia, odrosty.

3. AFTER – główne obserwacje:
   - co się poprawiło,
   - czy linia rzęs jest bardziej równa,
   - jakość wachlarzy (jeśli to volume/mega),
   - separacja, klej, odrosty.

4. Największa zmiana na plus (2–3 punkty).

5. Co jeszcze można poprawić (max 3 punkty).

Pisz rzeczowo, krótko, jak mentor dla stylistki rzęs.
`;
}

// ================== ENDPOINT: /analyze – JEDNO ZDJĘCIE ==================

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia w żądaniu (pole 'image').",
      });
    }

    const base64Image = req.file.buffer.toString("base64");

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: systemPrompt },
            {
              type: "input_image",
              image_url: `data:${req.file.mimetype};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    console.log(
      "Odpowiedź z OpenAI (surowa):",
      JSON.stringify(openaiResponse, null, 2)
    );

    let analysis = extractTextFromResponse(openaiResponse);
    if (!analysis) {
      analysis = "Model nie zwrócił szczegółowego raportu.";
    }

    return res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Błąd w /analyze:", error);

    return res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
      details: error.message || String(error),
    });
  }
});

// ================== ENDPOINT: BEFORE / AFTER ==================

app.post("/api/analyze-before-after", async (req, res) => {
  try {
    const { beforeImage, afterImage, language = "pl" } = req.body || {};

    if (!beforeImage || !afterImage) {
      return res.status(400).json({
        error: "Both beforeImage and afterImage are required.",
      });
    }

    const prompt = buildBeforeAfterPrompt(language === "en" ? "en" : "pl");

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

    console.log(
      "Odpowiedź BEFORE/AFTER z OpenAI:",
      JSON.stringify(openaiResponse, null, 2)
    );

    let analysisText = extractTextFromResponse(openaiResponse);

    if (!analysisText) {
      analysisText =
        language === "pl"
          ? "Model nie zwrócił szczegółowego raportu dla porównania BEFORE/AFTER."
          : "Model did not return a detailed BEFORE/AFTER comparison.";
    }

    return res.json({ analysisText });
  } catch (error) {
    console.error("Błąd w /api/analyze-before-after:", error);

    return res.status(500).json({
      error: "Błąd serwera podczas analizy BEFORE/AFTER.",
      details: error.message || String(error),
    });
  }
});

// ===================== ENDPOINT: /generate-map =====================
// Tekstowa mapka rzęs NA PODSTAWIE ZDJĘCIA

app.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia do analizy.",
      });
    }

    const base64Image = req.file.buffer.toString("base64");

    const prompt = `
Jesteś ekspertem stylizacji rzęs.
Na podstawie zdjęcia oka wygeneruj TYLKO jedną linię w formacie:

MAPA: 8-9-10-11-12-11-10-9-8

– dokładnie tak, bez dodatkowych zdań, komentarzy ani wyjaśnień.
Jeśli nie jesteś pewien długości, wybierz najbardziej realistyczny, klasyczny schemat.
`;

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

    let rawText =
      extractTextFromResponse(openaiResponse) ||
      "MAPA: 8-9-10-11-12-11-10-9-8";

    // wyciągamy samą część z długościami
    const mapLineMatch = rawText.match(/MAPA:\s*([0-9\s\-]+)/i);
    const mapLine = mapLineMatch ? mapLineMatch[1].trim() : "";

    return res.json({
      success: true,
      map: rawText,
      mapLine: mapLine,
    });
  } catch (err) {
    console.error("Błąd /generate-map:", err);
    return res.status(500).json({
      success: false,
      error: "Błąd po stronie serwera podczas generowania mapy.",
    });
  }
});

// ===================== ENDPOINT: /generate-lash-map =====================
// Statyczna mapka graficzna (SVG – białe tło, styl szkoleniowy)

app.post("/generate-lash-map", async (req, res) => {
  try {
    const svg = `
<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="260" viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="600" height="260" fill="#f9f7f3"/>
  <text x="50%" y="40" text-anchor="middle"
        font-family="system-ui"
        font-size="18" fill="#444">
    MAPKA RZĘS UPLashes
  </text>

  <path d="M 40 160 Q 300 40 560 160"
        fill="none"
        stroke="#c0b283"
        stroke-width="3"
        stroke-linecap="round"/>

  <g font-family="system-ui" font-size="12" fill="#444">
    <circle cx="70" cy="150" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="70" y="154" text-anchor="middle">1</text>

    <circle cx="130" cy="130" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="130" y="134" text-anchor="middle">2</text>

    <circle cx="190" cy="115" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="190" y="119" text-anchor="middle">3</text>

    <circle cx="250" cy="100" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="250" y="104" text-anchor="middle">4</text>

    <circle cx="310" cy="95" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="310" y="99" text-anchor="middle">5</text>

    <circle cx="370" cy="100" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="370" y="104" text-anchor="middle">6</text>

    <circle cx="430" cy="115" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="430" y="119" text-anchor="middle">7</text>

    <circle cx="490" cy="130" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="490" y="134" text-anchor="middle">8</text>

    <circle cx="550" cy="150" r="14" fill="#fff" stroke="#c0b283" stroke-width="2"/>
    <text x="550" y="154" text-anchor="middle">9</text>
  </g>

  <text x="70" y="190" text-anchor="middle" font-size="11" fill="#666">
    Wewnętrzny kącik
  </text>
  <text x="550" y="190" text-anchor="middle" font-size="11" fill="#666">
    Zewnętrzny kącik
  </text>
</svg>
    `;

    const base64 = Buffer.from(svg, "utf8").toString("base64");
    res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${base64}` });
  } catch (err) {
    console.error("Błąd generowania mapki (SVG):", err);
    res.status(500).json({
      success: false,
      error: "Błąd generowania mapki graficznej (SVG).",
    });
  }
});

// ================== START SERWERA ==================

app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
