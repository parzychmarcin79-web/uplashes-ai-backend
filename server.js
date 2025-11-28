// UPLashes AI – backend analizy zdjęć rzęs
// Funkcje:
// - /            – test, że serwer żyje
// - /ping        – prosty ping z frontu
// - /analyze     – analiza 1 zdjęcia oka
// - /api/analyze-before-after – analiza BEFORE/AFTER (2 obrazy jako base64 URL)
// - /generate-map       – tekstowa mapka rzęs na podstawie ZDJĘCIA
// - /generate-lash-map  – statyczna mapa graficzna (białe tło, 9 stref)

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// --------- MIDDLEWARE ---------
app.use(cors());
app.use(express.json());

// upload zdjęć – trzymamy w pamięci
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// klient OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --------- HELPER: wyciągnięcie tekstu z odpowiedzi OpenAI (Responses API) ---------
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

// --------- PROMPT do analizy 1 zdjęcia ---------
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
   - Zaproponuj 1–2 pasujące typy aplikacji (np. Klasyczne 1:1, Light Volume 2–3D, Anime, Mega Volume),
     z krótkim uzasadnieniem.
   - Na końcu dodaj: "Wstępna rekomendacja: …" (jaki typ aplikacji polecasz).
   - W takim przypadku NIE rób szczegółowej analizy sklejeń, itp.

KROK 3 – KLASYFIKACJA, JEŚLI JEST APLIKACJA
Jeśli widzisz stylizację (przedłużone rzęsy):

1. Określ szacunkowy TYP APLIKACJI:
   - Klasyczna 1:1
   - Light Volume 2–3D
   - Volume 4–6D
   - Mega Volume 7D+
2. Określ styl:
   - naturalny
   - delikatny volume
   - mocny volume
   - Anime / Spike Lashes (wyraźne kolce / spikes)
   - inny – opisz krótko.
3. Jeśli nie masz 100% pewności, zaznacz, że to ocena na podstawie zdjęcia.

KROK 4 – ZAawansowana ANALIZA TECHNICZNA (A)
Opisz krótko poniższe elementy:

1. Gęstość i pokrycie linii rzęs
2. Kierunek i ustawienie rzęs
3. Mapowanie i długości
4. Sklejone rzęsy / separacja
5. Odrosty
6. Klej

KROK 5 – JAKOŚĆ WACHLARZY (jeśli Volume / Mega Volume)
KROK 6 – TRYB ANIME / SPIKE (jeśli dotyczy)

KROK 7 – FORMAT ODPOWIEDZI (Markdown):

### AI.UPLashes REPORT

1. Ocena zdjęcia i rodzaju rzęs?
2. Typ stylizacji (jeśli jest)
3. Analiza techniczna
4. Jakość wachlarzy (jeśli dotyczy)
5. Tryb Anime / Spike (jeśli dotyczy)
6. Najważniejsze wskazówki do poprawy (max 3–5 punktów)

Na końcu:
"Wstępna klasyfikacja aplikacji: …"
"Rekomendacja kolejnego kroku dla stylistki: …"

Nie krytykuj klientki ani stylistki – pisz życzliwie i konstruktywnie.
`;

// --------- PROMPT BEFORE/AFTER ---------
function buildBeforeAfterPrompt(language = "pl") {
  return `
Jesteś ekspertem UPLashes AI.

Twoje zadanie:
Porównaj dwa zdjęcia rzęs: BEFORE (przed) i AFTER (po). Oceń, co się poprawiło,
co można jeszcze dopracować i czy efekt jest spójny z dobrą praktyką stylizacji rzęs.

Odpowiadasz tylko po polsku.

Struktura odpowiedzi (Markdown):

### AI.UPLashes REPORT – BEFORE / AFTER

1. Krótkie podsumowanie
2. BEFORE – główne obserwacje
3. AFTER – główne obserwacje
4. Największa zmiana na plus (2–3 punkty)
5. Co jeszcze można poprawić (max 3 punkty)

Pisz rzeczowo, krótko, jak mentor dla stylistki rzęs.
`;
}

// --------- PROSTE ENDPOINTY TESTOWE ---------
app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "UPLashes AI backend działa i odpowiada na /ping" });
});

// --------- /analyze – jedno zdjęcie ---------
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

// --------- /api/analyze-before-after ---------
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

// --------- /generate-map – tekstowa mapka na bazie ZDJĘCIA ---------
app.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    const lang = req.body.language === "en" ? "en" : "pl";

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia do analizy.",
      });
    }

    const base64Image = file.buffer.toString("base64");

    const mapPrompt =
      lang === "en"
        ? `
You are a lash styling expert. Look ONLY at the uploaded eye photo.
Return exactly ONE line in this format (nothing before or after):

MAPA: 8-9-10-11-12-11-10-9-8

Use numbers that best match the visible styling (shorter in inner corner, longer in outer corner).
`
        : `
Jesteś ekspertem stylizacji rzęs. Patrzysz TYLKO na wgrane zdjęcie oka.
Zwróć dokładnie JEDNĄ linię w tym formacie (bez dodatkowych zdań):

MAPA: 8-9-10-11-12-11-10-9-8

Dobierz długości tak, aby pasowały do stylizacji (krócej w wewnętrznym kąciku, dłużej w zewnętrznym).
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
              image_url: `data:${file.mimetype};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    const rawText =
      extractTextFromResponse(openaiResponse) ||
      "MAPA: 8-9-10-11-12-11-10-9-8";

    const match = rawText.match(/MAPA:\s*([0-9\s\-]+)/i);
    const mapLine = match ? match[1].trim() : "";

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

// --------- /generate-lash-map – statyczne SVG (białe tło, 9 stref) ---------
app.post("/generate-lash-map", async (req, res) => {
  try {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="260" viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="600" height="260" fill="#ffffff"/>
  <text x="50%" y="36" text-anchor="middle"
        font-family="system-ui"
        font-size="18" fill="#111827">
    Mapka rzęs • UPLashes
  </text>

  <text x="50%" y="54" text-anchor="middle"
        font-family="system-ui"
        font-size="11" fill="#6b7280">
    Styl B – białe tło, karta mappingowa
  </text>

  <path d="M 80 170 A 260 260 0 0 1 520 170"
        fill="none"
        stroke="#e5e7eb"
        stroke-width="1.6"/>

  <path d="M 80 210 A 260 260 0 0 1 520 210"
        fill="none"
        stroke="#9ca3af"
        stroke-width="1.8"/>

  <g font-family="system-ui" font-size="11" fill="#374151">
    <line x1="110" y1="160" x2="110" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="110" y="148" text-anchor="middle">8 mm</text>
    <text x="110" y="222" text-anchor="middle" fill="#6b7280">1</text>

    <line x1="160" y1="157" x2="160" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="160" y="145" text-anchor="middle">9 mm</text>
    <text x="160" y="222" text-anchor="middle" fill="#6b7280">2</text>

    <line x1="210" y1="154" x2="210" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="210" y="142" text-anchor="middle">10 mm</text>
    <text x="210" y="222" text-anchor="middle" fill="#6b7280">3</text>

    <line x1="260" y1="152" x2="260" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="260" y="140" text-anchor="middle">11 mm</text>
    <text x="260" y="222" text-anchor="middle" fill="#6b7280">4</text>

    <line x1="310" y1="151" x2="310" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="310" y="139" text-anchor="middle">12 mm</text>
    <text x="310" y="222" text-anchor="middle" fill="#6b7280">5</text>

    <line x1="360" y1="152" x2="360" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="360" y="140" text-anchor="middle">11 mm</text>
    <text x="360" y="222" text-anchor="middle" fill="#6b7280">6</text>

    <line x1="410" y1="154" x2="410" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="410" y="142" text-anchor="middle">10 mm</text>
    <text x="410" y="222" text-anchor="middle" fill="#6b7280">7</text>

    <line x1="460" y1="157" x2="460" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="460" y="145" text-anchor="middle">9 mm</text>
    <text x="460" y="222" text-anchor="middle" fill="#6b7280">8</text>

    <line x1="510" y1="160" x2="510" y2="205" stroke="#d1d5db" stroke-width="1.2"/>
    <text x="510" y="148" text-anchor="middle">8 mm</text>
    <text x="510" y="222" text-anchor="middle" fill="#6b7280">9</text>
  </g>

  <text x="80" y="240" text-anchor="start"
        font-family="system-ui" font-size="11" fill="#6b7280">
    Wewnętrzny kącik
  </text>
  <text x="520" y="240" text-anchor="end"
        font-family="system-ui" font-size="11" fill="#6b7280">
    Zewnętrzny kącik
  </text>
</svg>`;

    const base64 = Buffer.from(svg, "utf8").toString("base64");
    return res.json({
      success: true,
      imageUrl: `data:image/svg+xml;base64,${base64}`,
    });
  } catch (err) {
    console.error("Błąd generowania mapki (SVG):", err);
    return res.status(500).json({
      success: false,
      error: "Błąd generowania mapki graficznej (SVG).",
    });
  }
});

// --------- START SERWERA ---------
app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
