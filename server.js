// UPLashes AI – backend analizy zdjęć rzęs
// Wersja z rozszerzoną analizą:
// A) Zaawansowana kontrola aplikacji (sklejenia, kierunki, odrosty, klej)
// B) Rozpoznawanie jakości wachlarzy Volume / Mega Volume
// C) Tryb Anime / Spike Lashes
// D) Mapki rzęs na podstawie zdjęcia (tekstowo)

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();

// Middleware – JEDEN raz
app.use(cors());
app.use(express.json());

// Multer – plik w pamięci (do uploadu zdjęć)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Port – Render zwykle podaje PORT w env
const PORT = process.env.PORT || 10000;

// Klient OpenAI – musi być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================== ENDPOINTY PODSTAWOWE ==================

// Prosty endpoint zdrowia
app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

// Endpoint do pingu z frontendu
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

    let chunks = [];

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
   - Czy linia rzęs jest równomiernie pokryta?
   - Czy są wyraźne luki / dziury?

2. Kierunek i ustawienie rzęs
   - Czy rzęsy idą w podobnym kierunku?
   - Czy widać rzęsy „uciekające” w inne strony lub krzyżujące się?

3. Mapowanie i długości
   - Czy przejścia długości są płynne?
   - Czy mapowanie pasuje do kształtu oka (nie musisz nazywać efektu, jeśli nie jesteś pewien)?

4. Sklejone rzęsy / separacja
   - Czy widać sklejenia naturalnych rzęs?
   - Czy to drobne niedociągnięcia, czy poważniejsze błędy?
   - Zasugeruj, jak poprawić separację.

5. Odrosty
   - Czy widać mocne odrosty, wachlarze odsunięte od linii powieki?
   - Jeśli tak – zasugeruj korektę / wymianę przy kolejnym uzupełnianiu.

6. Klej
   - Czy nasady są czyste?
   - Czy widać grudki, kuleczki, nadmiar kleju?
   - Napisz, czy ilość kleju wygląda na odpowiednią.

KROK 5 – JAKOŚĆ WACHLARZY VOLUME / MEGA VOLUME (B)
Jeśli aplikacja wygląda na Volume 4–6D lub Mega Volume 7D+:

1. Oceń wachlarze:
   - czy są równomiernie rozłożone,
   - czy mają ładne, wąskie bazy,
   - czy nie są zbyt zbite („kikut” zamiast wachlarza).
2. Oceń ciężkość:
   - czy wachlarze nie są zbyt ciężkie dla naturalnych rzęs.
3. Podsumuj krótko jakość wachlarzy:
   - bardzo dobra / poprawna / wymaga pracy.
Jeśli to klasyka lub bardzo delikatny volume:
   - napisz: "B) Mega Volume: nie dotyczy tej aplikacji."

KROK 6 – TRYB ANIME / SPIKE LASHES (C)
Jeśli stylizacja ma wyraźne kolce / spikes:

1. Oceń:
   - jakość i gładkość spike’ów,
   - rozmieszczenie spike’ów,
   - wypełnienie pomiędzy spike’ami (czy nie jest zbyt ciężkie lub zbyt puste).
2. Zasugeruj, jak poprawić efekt Anime / Spike (kształt kolców, gęstość tła).
Jeśli styl NIE jest Anime / Spike:
   - napisz: "C) Anime / Spike Lashes: nie dotyczy tego zdjęcia."

KROK 7 – FORMAT ODPOWIEDZI
Zwróć odpowiedź w formie krótkiego raportu w Markdown:

### AI.UPLashes REPORT

1. Ocena zdjęcia i rodzaju rzęs?
   - Krótka informacja: aplikacja / naturalne rzęsy / zdjęcie nieprzydatne.

2. Typ stylizacji (jeśli jest):
   - Rodzaj: Klasyczna 1:1 / Light Volume 2–3D / Volume 4–6D / Mega Volume 7D+
   - Styl: naturalny / delikatny volume / mocny volume / Anime / inny.

3. Analiza techniczna:
   - Gęstość i pokrycie
   - Kierunek i ustawienie
   - Mapowanie i długości
   - Sklejone rzęsy / separacja
   - Odrosty
   - Klej

4. Jakość wachlarzy (jeśli Volume/Mega):
   - krótka ocena.

5. Tryb Anime / Spike (jeśli dotyczy):
   - co jest dobre, co można dopracować.

6. Najważniejsze wskazówki do poprawy (max 3–5 punktów):
   - konkretne, praktyczne rady dla stylistki.

Na końcu dodaj:
"Wstępna klasyfikacja aplikacji: …"
"Rekomendacja kolejnego kroku dla stylistki: …"

Nie krytykuj klientki ani stylistki – pisz życzliwie i konstruktywnie.
`;

// ================== HELPER: PROMPT BEFORE / AFTER ==================

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

4. Największa zmiana na plus (2–3 punkty):
   - ...

5. Co jeszcze można poprawić (max 3 punkty):
   - bardzo konkretne wskazówki dla stylistki.

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
              image_url: `data:image/jpeg;base64,${base64Image}`,
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

    const prompt = buildBeforeAfterPrompt(
      language === "en" ? "en" : "pl"
    );

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
// Tekstowa mapka rzęs na podstawie zdjęcia
app.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    const lang = req.body.language || "pl";

    if (!file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia do analizy.",
      });
    }

    const base64Image = file.buffer.toString("base64");

    // prosimy model o krótką mapkę rzęs z jedną linią MAPA: 8-9-10...
    const prompt =
      lang === "en"
        ? "You are a lash mapping expert. Return one line in English with the word MAPA: and 9 lengths, e.g. MAPA: 8-9-10-11-12-11-10-9-8. No explanations."
        : "Jesteś ekspertem stylizacji rzęs. Zwróć tylko jedną linię po polsku z mapką długości, np. MAPA: 8-9-10-11-12-11-10-9-8. Bez żadnych dodatkowych zdań.";

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: `data:${file.mimetype};base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    let rawText =
      extractTextFromResponse(openaiResponse) ||
      "MAPA: 8-9-10-11-12-11-10-9-8";

    // wyciągamy sam ciąg długości
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

// ===================== ENDPOINT: /generate-lash-map =====================
// Statyczna mapa graficzna (SVG) – styl B, białe tło, szkoleniowa karta
app.post("/generate-lash-map", async (req, res) => {
  try {
    const svg = `
<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="260" viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="600" height="260" fill="#ffffff"/>
  <text x="50%" y="30" text-anchor="middle"
        font-family="system-ui"
        font-size="18" fill="#111827">
    Mapka rzęs • UPLashes
  </text>

  <text x="50%" y="48" text-anchor="middle"
        font-family="system-ui"
        font-size="11" fill="#6b7280">
    Styl B – białe tło, karta mappingowa
  </text>

  <path d="M 80 150 A 260 260 0 0 1 520 150"
        fill="none"
        stroke="#d1d5db"
        stroke-width="1.8" />

  <path d="M 80 210 A 260 260 0 0 1 520 210"
        fill="none"
        stroke="#9da3b1"
        stroke-width="2.0" />

  <g font-family="system-ui" font-size="12" fill="#374151">
    <line x1="120" y1="155" x2="120" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="120" y="140" text-anchor="middle">7 mm</text>
    <text x="120" y="225" text-anchor="middle" fill="#6b7280">1</text>

    <line x1="170" y1="150" x2="170" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="170" y="135" text-anchor="middle">8 mm</text>
    <text x="170" y="225" text-anchor="middle" fill="#6b7280">2</text>

    <line x1="220" y1="145" x2="220" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="220" y="130" text-anchor="middle">9 mm</text>
    <text x="220" y="225" text-anchor="middle" fill="#6b7280">3</text>

    <line x1="270" y1="142" x2="270" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="270" y="127" text-anchor="middle">10 mm</text>
    <text x="270" y="225" text-anchor="middle" fill="#6b7280">4</text>

    <line x1="320" y1="140" x2="320" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="320" y="125" text-anchor="middle">11 mm</text>
    <text x="320" y="225" text-anchor="middle" fill="#6b7280">5</text>

    <line x1="370" y1="142" x2="370" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="370" y="127" text-anchor="middle">10 mm</text>
    <text x="370" y="225" text-anchor="middle" fill="#6b7280">6</text>

    <line x1="420" y1="145" x2="420" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="420" y="130" text-anchor="middle">9 mm</text>
    <text x="420" y="225" text-anchor="middle" fill="#6b7280">7</text>

    <line x1="470" y1="150" x2="470" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="470" y="135" text-anchor="middle">8 mm</text>
    <text x="470" y="225" text-anchor="middle" fill="#6b7280">8</text>

    <line x1="520" y1="155" x2="520" y2="205" stroke="#9da3b1" stroke-width="1.2"/>
    <text x="520" y="140" text-anchor="middle">7 mm</text>
    <text x="520" y="225" text-anchor="middle" fill="#6b7280">9</text>
  </g>

  <text x="80" y="240"
        text-anchor="start"
        font-size="11"
        font-family="system-ui"
        fill="#6b7280">
    Wewnętrzny kącik
  </text>
  <text x="520" y="240"
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

// ================== START SERWERA ==================

app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
