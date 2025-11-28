// UPLashes AI – backend analizy zdjęć rzęs

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();

// ===== MIDDLEWARE (raz, globalnie) =====
app.use(cors());
app.use(express.json());

// Multer – plik w pamięci
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Port z Render albo 10000 lokalnie
const PORT = process.env.PORT || 10000;

// Klient OpenAI (SDK v4)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== PROSTE ENDPOINTY ZDROWIA =====

app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// ===== HELPER: WYCIĄGANIE TEKSTU Z ODPOWIEDZI OpenAI (responses.create) =====

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
    if (joined) return joined;
  } catch (e) {
    console.error("Błąd przy parsowaniu odpowiedzi OpenAI:", e);
  }

  return "";
}

// ===== PROMPT GŁÓWNY (JEDNO ZDJĘCIE) =====

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
   i NIC WIĘCEJ nie pisz.
3. Jeśli wszystko jest OK – przejdź dalej.

KROK 2 – CZY JEST APLIKACJA, CZY NATURALNE RZĘSY
1. Ustal:
   - Czy są założone rzęsy PRZEDŁUŻANE (aplikacja).
   - Czy widać tylko NATURALNE rzęsy bez aplikacji.
2. Jeśli widzisz TYLKO naturalne rzęsy:
   - Napisz, że nie widzisz stylizacji rzęs, tylko naturalne rzęsy.
   - Oceń gęstość i długość naturalnych rzęs, kierunek wzrostu, ewentualne ubytki.
   - Zaproponuj 1–2 pasujące typy aplikacji.
   - Na końcu dodaj: "Wstępna rekomendacja: …".
   - W takim przypadku NIE rób szczegółowej analizy sklejeń, itp.

KROK 3 – KLASYFIKACJA, JEŚLI JEST APLIKACJA
1. Określ typ aplikacji: Klasyczna 1:1 / Light Volume 2–3D / Volume 4–6D / Mega Volume 7D+.
2. Określ styl: naturalny / delikatny volume / mocny volume / Anime / Spike / inny.

KROK 4 – ZAawansowana ANALIZA TECHNICZNA:
- Gęstość i pokrycie
- Kierunek i ustawienie
- Mapowanie i długości
- Sklejone rzęsy / separacja
- Odrosty
- Klej

KROK 5 – JAKOŚĆ WACHLARZY (jeśli Volume/Mega).
KROK 6 – Anime / Spike (jeśli dotyczy).
KROK 7 – Format odpowiedzi: markdown z sekcjami 1–6 + podsumowanie.
`;

// ===== PROMPT BEFORE / AFTER =====

function buildBeforeAfterPrompt(language = "pl") {
  return `
Jesteś ekspertem UPLashes AI.

Porównaj dwa zdjęcia rzęs: BEFORE (przed) i AFTER (po).
Oceń, co się poprawiło, co można jeszcze dopracować.

Odpowiadasz po polsku.

Struktura odpowiedzi (Markdown):

### AI.UPLashes REPORT – BEFORE / AFTER

1. Krótkie podsumowanie.
2. BEFORE – główne obserwacje.
3. AFTER – główne obserwacje.
4. Największa zmiana na plus (2–3 punkty).
5. Co jeszcze można poprawić (max 3 punkty).

Pisz rzeczowo, jak mentor dla stylistki rzęs.
`;
}

// ===== /analyze – JEDNO ZDJĘCIE =====

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
      "Odpowiedź z OpenAI (analyze):",
      JSON.stringify(openaiResponse, null, 2)
    );

    let analysis = extractTextFromResponse(openaiResponse);
    if (!analysis) {
      analysis = "Model nie zwrócił szczegółowego raportu.";
    }

    return res.json({ success: true, analysis });
  } catch (error) {
    console.error("Błąd w /analyze:", error);
    return res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
      details: error.message || String(error),
    });
  }
});

// ===== /api/analyze-before-after =====

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

// ===== /generate-map – TEKSTOWA MAPKA Z ZDJĘCIA =====

app.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia do analizy.",
      });
    }

    const base64Image = req.file.buffer.toString("base64");

    const mapPrompt = `
Jesteś ekspertem stylizacji rzęs.
Na podstawie zdjęcia wygeneruj TYLKO jedną linię w formacie:
MAPA: 8-9-10-11-12-11-10-9-8
Bez dodatkowego tekstu. Liczby są długościami rzęs w mm w 9 strefach od kącika wewnętrznego do zewnętrznego.
`;

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: mapPrompt },
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

    return res.json({
      success: true,
      map: rawText,
      mapLine,
    });
  } catch (err) {
    console.error("Błąd /generate-map:", err);
    return res.status(500).json({
      success: false,
      error: "Błąd po stronie serwera podczas generowania mapy.",
    });
  }
});

// ===== /generate-lash-map – STATYCZNA MAPKA SVG (biała karta szkoleniowa) =====

app.post("/generate-lash-map", async (req, res) => {
  try {
    const svg = `
<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="260" viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="600" height="260" fill="#ffffff"/>
  <text x="50%" y="40" text-anchor="middle"
        font-family="system-ui"
        font-size="18" fill="#111827">
    Mapka rzęs • UPLashes
  </text>

  <text x="50%" y="58" text-anchor="middle"
        font-family="system-ui"
        font-size="11" fill="#6b7280">
    Styl B – białe tło, karta mappingowa
  </text>

  <path d="M 80 150 A 260 260 0 0 1 520 150"
        fill="none"
        stroke="#d1d5db"
        stroke-width="1.6" />

  <path d="M 80 210 A 260 260 0 0 1 520 210"
        fill="none"
        stroke="#9da3b1"
        stroke-width="2.0" />

  <g font-family="system-ui" font-size="11" fill="#374151">
    <line x1="110" y1="150" x2="110" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="110" y="138" text-anchor="middle">7 mm</text>
    <text x="110" y="222" text-anchor="middle" fill="#6b7280">1</text>

    <line x1="160" y1="147" x2="160" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="160" y="135" text-anchor="middle">8 mm</text>
    <text x="160" y="222" text-anchor="middle" fill="#6b7280">2</text>

    <line x1="210" y1="143" x2="210" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="210" y="131" text-anchor="middle">9 mm</text>
    <text x="210" y="222" text-anchor="middle" fill="#6b7280">3</text>

    <line x1="260" y1="138" x2="260" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="260" y="126" text-anchor="middle">10 mm</text>
    <text x="260" y="222" text-anchor="middle" fill="#6b7280">4</text>

    <line x1="310" y1="136" x2="310" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="310" y="124" text-anchor="middle">11 mm</text>
    <text x="310" y="222" text-anchor="middle" fill="#6b7280">5</text>

    <line x1="360" y1="138" x2="360" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="360" y="126" text-anchor="middle">10 mm</text>
    <text x="360" y="222" text-anchor="middle" fill="#6b7280">6</text>

    <line x1="410" y1="143" x2="410" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="410" y="131" text-anchor="middle">9 mm</text>
    <text x="410" y="222" text-anchor="middle" fill="#6b7280">7</text>

    <line x1="460" y1="147" x2="460" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="460" y="135" text-anchor="middle">8 mm</text>
    <text x="460" y="222" text-anchor="middle" fill="#6b7280">8</text>

    <line x1="510" y1="150" x2="510" y2="210" stroke="#d1d5db" stroke-width="1.2" />
    <text x="510" y="138" text-anchor="middle">7 mm</text>
    <text x="510" y="222" text-anchor="middle" fill="#6b7280">9</text>
  </g>

  <text x="80" y="238"
        text-anchor="start"
        font-size="11"
        font-family="system-ui"
        fill="#6b7280">
    Wewnętrzny kącik
  </text>
  <text x="520" y="238"
        text-anchor="end"
        font-size="11"
        font-family="system-ui"
        fill="#6b7280">
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

// ===== START SERWERA =====

app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
