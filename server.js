// UPLashes AI – backend analizy zdjęć rzęs
// Wersja z rozszerzoną analizą:
// A) Zaawansowana kontrola aplikacji (sklejenia, kierunki, odrosty, klej)
// B) Rozpoznawanie jakości wachlarzy Volume / Mega Volume
// C) Tryb Anime / Spike Lashes

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Multer – trzymamy plik w pamięci
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

// ================== PROMPT SYSTEMOWY ==================

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

1. Czy widzę stylizację?
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

// ================== ROUTES ==================

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

// Pomocnicza funkcja – agresywne wyciąganie tekstu z odpowiedzi OpenAI
function extractTextFromResponse(openaiResponse) {
  try {
    // 1) Najpierw spróbuj prostego helpera
    if (typeof openaiResponse.output_text === "string") {
      const t = openaiResponse.output_text.trim();
      if (t) return t;
    }

    let chunks = [];

    // 2) Parsowanie output[]
    if (Array.isArray(openaiResponse.output)) {
      for (const item of openaiResponse.output) {
        if (!item || !Array.isArray(item.content)) continue;

        for (const part of item.content) {
          if (!part) continue;

          // Nowy format: { type: "output_text", text: [ { type: "text", text: "..." } ] }
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
// GŁÓWNY ENDPOINT ANALIZY – JEDNO ZDJĘCIE
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
      // UWAGA: BEZ response_format – domyślnie dostajemy tekst
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: systemPrompt,
            },
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

// ====== HELPER: prompt do analizy BEFORE / AFTER ======
function buildBeforeAfterPrompt(language) {
  const isPL = language === "pl";

  if (isPL) {
    return `
Jesteś ekspertem od stylizacji rzęs i instruktorem UPLashes.
Otrzymujesz DWIE FOTOGRAFIE: BEFORE (przed aplikacją lub gorsza stylizacja) oraz AFTER (po aplikacji / poprawiona stylizacja).

Twoje zadanie:
1) Porównaj te zdjęcia jak instruktor na szkoleniu PRO.
2) Zwróć jasny, konkretny feedback w języku POLSKIM.
3) Skup się na:
   - gęstości rzęs i wypełnieniu linii,
   - kierunku rzęs i symetrii,
   - jakości kępek (równomierność, ciężkość, jak siedzą na rzęsach naturalnych),
   - doborze długości i skrętu (czy są bezpieczne dla naturalnych rzęs),
   - ogólnym efekcie estetycznym (czystość pracy, estetyka linii, styl).

Struktura odpowiedzi:
1. Krótkie podsumowanie postępu (2–3 zdania).
2. Co jest zrobione dobrze – wypunktuj.
3. Co można poprawić – wypunktuj, bardzo konkretnie (jak na szkoleniu).
4. Sugestie dla stylistki – praktyczne wskazówki (technika, dobranie długości, kierunek, separacja, praca z klejem).

Pisz profesjonalnie, ale wspierająco – jak instruktor, który chce, aby stylistka robiła coraz lepsze aplikacje.
    `.trim();
  }

  return `
You are a lash extension expert and trainer for UPLashes.
You receive TWO PHOTOS: BEFORE (prior to application or lower-quality set) and AFTER (improved/final set).

Your task:
1) Compare these photos like a PRO trainer.
2) Return clear, structured feedback in ENGLISH.
3) Focus on:
   - lash density and fill along the lash line,
   - direction, symmetry and overall mapping,
   - fan quality (evenness, weight, how they sit on natural lashes),
   - length and curl choice (are they safe and suitable for the natural lashes?),
   - overall look (clean work, neatness of the lash line, style).

Structure your answer:
1. Short summary of progress (2–3 sentences).
2. What looks good – bullet points.
3. What should be improved – bullet points, very concrete (as in a training review).
4. Suggestions for the lash tech – practical tips (technique, length choice, direction, separation, glue control).

Write in a professional but supportive tone – like a trainer who wants the lash tech to grow.
  `.trim();
}

// ====== ENDPOINT: /api/analyze-before-after – DWIE FOTY (JSON, base64) ======
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
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: beforeImage,
            },
            {
              type: "input_image",
              image_url: afterImage,
            },
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

// Start serwera
app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});


