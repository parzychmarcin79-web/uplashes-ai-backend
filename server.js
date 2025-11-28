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

// Multer – trzymamy plik w pamięci (do uploadu zdjęć)
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
  // Możemy w przyszłości dodać wersję EN – na razie tylko PL
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
// ===================== ENDPOINT: /generate-lash-map =====================
app.post("/generate-lash-map", async (req, res) => {
  try {
    const { analysisText } = req.body || {};

    const prompt = `
Jesteś graficznym asystentem marki UPLashes.
Na podstawie opisu wygeneruj prostą, czytelną MAPKĘ RZĘS jako obraz.

Wytyczne mapki:
- delikatna linia oka w odcieniach beżu i złota (UPLashes kolorystyka),
- podział na 9 stref zgodnie z naturalną linią rzęs,
- strefy podpisane 1–9,
- długości zawsze w mm,
- kącik wewnętrzny i zewnętrzny wyraźnie oznaczone,
- jeśli opis zawiera informację o przerzedzeniu w kącikach — pokaż to na grafice,
- styl ma przypominać profesjonalną stylizację rzęs, NIE anime, NIE spike,
- na grafice NIE wolno używać słów anime/spike.

Opis przekazany z analizy AI:
${analysisText || "Brak dodatkowych danych – wygeneruj klasyczną mapkę 7–11 mm z delikatnym kępkowaniem."}
    `;

    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    const base64 = result.data[0].b64_json;
    const imageUrl = `data:image/png;base64,${base64}`;

    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error("Błąd generowania mapki:", err);
    res.status(500).json({
      success: false,
      error: "Błąd generowania mapki graficznej.",
    });
  }
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

// =======================  ENDPOINT: /generate-map  ==========================
app.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia w żądaniu (pole 'image').",
      });
    }

    const base64Image = req.file.buffer.toString("base64");

    const systemPrompt = `
Jesteś asystentem UPLashes. Na podstawie zdjęcia oka:
- oceniasz kształt i proporcje,
- dobierasz MAPKĘ DŁUGOŚCI rzęs w 9 strefach (1–9, od wewnętrznego do zewnętrznego kącika),
- zapisujesz ją JEDNYM ciągiem liczb, np. "7-8-9-10-11-10-9-8-7".

ZWRÓĆ ODPOWIEDŹ TYLKO W FORMIE:
MAP: 7-8-9-10-11-10-9-8-7

Bez dodatkowego opisu, komentarzy, tekstu.
Jeśli zdjęcie jest całkowicie nieczytelne, zwróć:
MAP: 7-8-9-10-11-10-9-8-7
    `.trim();

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

    const rawText =
      openaiResponse.output[0]?.content?.[0]?.text?.trim() || "";

    // wyciągamy sam ciąg po "MAP:"
    const match = rawText.match(/MAP:\s*([0-9\-\s]+)/i);
    const mapString = match ? match[1].trim() : rawText;

    return res.json({
      success: true,
      map: mapString,
    });
  } catch (error) {
    console.error("Błąd w /generate-map:", error);
    return res.status(500).json({
      success: false,
      error: "Błąd po stronie serwera przy generowaniu mapy.",
    });
  }
});

  // Szukamy linii "MAPA: 8-9-10-..." - to będzie baza do mapy graficznej
const mapLineMatch = rawText.match(/MAPA:\s*([0-9\s\-]+)/i);
const mapLine = mapLineMatch ? mapLineMatch[0] : "";

return res.json({
  success: true,
  // pełny opis do panelu tekstowego
  map: rawText,
  // surowa linia z długościami (gdyby frontend chciał użyć bez regexa)
  mapLine: mapLine,
});
} catch (error) {
  console.error("Błąd generowania mapki:", error);
  return res.status(500).json({
    success: false,
    error: "Błąd podczas generowania mapki.",
    details: error.message,
  });
}
});

// ===================== ENDPOINT: /generate-lash-map =====================
app.post("/generate-lash-map", async (req, res) => {
  try {
    // Prosta, statyczna mapka w SVG – łuk + 9 stref (Styl B – białe tło, karta mappingowa)
    const svg = `
<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="260" viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="600" height="260" fill="#ffffff"/>

  <text x="50%" y="30" text-anchor="middle"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="18" fill="#111827">
    Mapka rzęs • UPLashes
  </text>

  <text x="50%" y="48" text-anchor="middle"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="11" fill="#6b7280">
    Styl B – białe tło, karta mappingowa
  </text>

  <!-- łuk oka -->
  <path d="M 90 190 A 220 220 0 0 1 530 190"
        fill="none"
        stroke="#e5e7eb"
        stroke-width="1.6" />

  <path d="M 90 230 A 220 220 0 0 1 530 230"
        fill="none"
        stroke="#9ca3af"
        stroke-width="1.8" />

  <!-- strefy 1–9 -->
  <g font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
     font-size="12" fill="#444">
    <!-- Strefa 1 -->
    <circle cx="70" cy="210" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="70" y="214" text-anchor="middle">1</text>

    <!-- Strefa 2 -->
    <circle cx="130" cy="200" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="130" y="204" text-anchor="middle">2</text>

    <!-- Strefa 3 -->
    <circle cx="190" cy="190" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="190" y="194" text-anchor="middle">3</text>

    <!-- Strefa 4 -->
    <circle cx="250" cy="182" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="250" y="186" text-anchor="middle">4</text>

    <!-- Strefa 5 -->
    <circle cx="310" cy="178" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="310" y="182" text-anchor="middle">5</text>

    <!-- Strefa 6 -->
    <circle cx="370" cy="182" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="370" y="186" text-anchor="middle">6</text>

    <!-- Strefa 7 -->
    <circle cx="430" cy="190" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="430" y="194" text-anchor="middle">7</text>

    <!-- Strefa 8 -->
    <circle cx="490" cy="200" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="490" y="204" text-anchor="middle">8</text>

    <!-- Strefa 9 -->
    <circle cx="550" cy="210" r="14" fill="#ffffff" stroke="#d1d5db" stroke-width="1.4"/>
    <text x="550" y="214" text-anchor="middle">9</text>
  </g>

  <!-- podpisy kącików -->
  <text x="90" y="248" text-anchor="start" font-size="11" fill="#6b7280">
    Wewnętrzny kącik
  </text>
  <text x="530" y="248" text-anchor="end" font-size="11" fill="#6b7280">
    Zewnętrzny kącik
  </text>
</svg>
    `;

    const base64 = Buffer.from(svg, "utf8").toString("base64");
    const imageUrl = `data:image/svg+xml;base64,${base64}`;

    return res.json({ success: true, imageUrl });
  } catch (err) {
    console.error("Błąd generowania mapki (SVG):", err);
    return res.status(500).json({
      success: false,
      error: "Błąd generowania mapki graficznej (SVG).",
    });
  }
});

// ================== START SERWERA ==================

app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
