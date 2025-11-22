// UPLashes AI – backend analizy zdjęć rzęs
// Wersja z rozszerzoną analizą:
// A) Zaawansowana kontrola aplikacji (sklejenia, kierunki, odrosty, klej)
// B) Rozpoznawanie jakości wachlarzy Mega Volume
// C) Tryb Anime / Spike Lashes

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

// --- konfiguracja podstawowa ---

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- zdrowie serwera ---

app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// --- główny endpoint analizy ---

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Brak zdjęcia." });
    }

    const base64Image = req.file.buffer.toString("base64");

    const systemPrompt =
      "Jesteś ekspertem UPLashes AI od zaawansowanej analizy stylizacji rzęs na zdjęciach. " +
      "Zawsze analizujesz JEDNO oko / jedną powiekę. Pisz po polsku, prostym językiem, ale profesjonalnie – tak jak do stylistki rzęs. " +
      "\n\n" +
      "KROK 1 – Najpierw oceń, czy zdjęcie w ogóle nadaje się do analizy. " +
      "Poprawne zdjęcie: wyraźne, w miarę bliskie ujęcie jednego oka z rzęsami (naturalne lub przedłużone). " +
      "Niepoprawne zdjęcie: podłoga, ściana, całe selfie bez szczegółów oka, ekran, dokument, tekst, itp. " +
      "Jeśli zdjęcie jest niepoprawne i nie widzisz wyraźnie oka z rzęsami, odpowiedz tylko jednym zdaniem: " +
      "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska. " +
      "W takim przypadku NIC WIĘCEJ nie dopisuj." +
      "\n\n" +
      "KROK 2 – Jeśli zdjęcie jest poprawne, ustal co widzisz: " +
      "1) Czy na rzęsach jest wykonana aplikacja (przedłużanie rzęs)? " +
      "2) Czy są to tylko naturalne rzęsy bez aplikacji? " +
      "Jeśli widzisz tylko naturalne rzęsy bez stylizacji, napisz krótko, że nie ma aplikacji, " +
      "oceń gęstość i długość naturalnych rzęs oraz zaproponuj 1–2 typy aplikacji (np. Klasyczne 1:1, Light Volume 2–3D, Anime, Mega Volume) " +
      "pasujące do tego oka, z krótkim uzasadnieniem." +
      "\n\n" +
      "KROK 3 – Jeśli widzisz aplikację, spróbuj ją sklasyfikować: " +
      "• rodzaj: Klasyczna 1:1, Light Volume 2–3D, Volume 4–6D, Mega Volume 7D+ " +
      "• styl/efekt: naturalny, delikatny volume, mocny volume, Anime / Spike Lashes (widoczne kolce/spikes), inny (opisz krótko). " +
      "Jeśli nie jesteś pewny, napisz, że to szacunkowa ocena na podstawie zdjęcia." +
      "\n\n" +
      "KROK 4 – CZĘŚĆ A: zaawansowana kontrola aplikacji (dotyczy tylko, gdy jest aplikacja). Opisz: " +
      "• Gęstość i pokrycie: czy linia rzęs jest równomiernie pokryta, czy widać dziury/przerzedzenia. " +
      "• Kierunek: czy rzęsy patrzą w podobnym kierunku, czy są rzęsy uciekające lub krzyżujące się. " +
      "• Mapowanie i długości: czy przejścia długości są płynne, czy mapowanie pasuje do oka, czy nie ma gwałtownych skoków. " +
      "• Sklejone rzęsy: czy widać sklejenia kilku naturalnych rzęs, lub wachlarze przyklejone nieprawidłowo. " +
      "• Odrosty: czy widzisz odrosty – rzęsy wyglądające na mocno odsunięte od linii powieki. " +
      "• Klej: czy podstawy są czyste, czy widać grudki, kuleczki kleju, błyszczące zgrubienia. " +
      "Wymień największe plusy techniczne oraz 2–3 najważniejsze rzeczy do poprawy." +
      "\n\n" +
      "KROK 5 – CZĘŚĆ B: jakość wachlarzy Volume / Mega Volume. " +
      "Stosuj tę część tylko, gdy stylizacja wygląda na Volume (4–6D) lub Mega Volume (7D+). " +
      "Oceń: czy wachlarze są równomierne, symetryczne, czy nie są zbyt zbite (kikut zamiast wachlarza), " +
      "czy bazy wachlarzy są wąskie i czyste, oraz czy wachlarze nie są zbyt ciężkie dla naturalnych rzęs. " +
      "Napisz krótko ogólną ocenę jakości wachlarzy: bardzo dobra, poprawna, wymaga pracy. " +
      "Jeśli aplikacja jest klasyczna lub bardzo delikatny volume, napisz wyraźnie: B) Mega Volume: nie dotyczy tej aplikacji." +
      "\n\n" +
      "KROK 6 – CZĘŚĆ C: tryb Anime / Spike Lashes. " +
      "Jeśli stylizacja ma wyraźne kolce/spikes w stylu Anime, oceń: " +
      "• jakość kolców: czy są wyraźne, gładkie i równe, czy nie są przypadkowymi sklejeniami, " +
      "• rozmieszczenie: czy spikes są rozmieszczone logicznie i estetycznie wzdłuż linii rzęs, " +
      "• wypełnienie między spike'ami: czy volume pomiędzy jest równomierny, czy efekt nie jest zbyt ciężki lub zbyt pusty. " +
      "Jeśli styl nie jest Anime/Spike, napisz jasno: C) Anime / Spike Lashes: nie dotyczy tego zdjęcia." +
      "\n\n" +
      "KROK 7 – Forma odpowiedzi. " +
      "Zwróć odpowiedź w formie krótkiego raportu w stylu Markdown, ale bez używania znaku backtick (`). " +
      "Użyj mniej więcej takiej struktury: " +
      "1. Czy widzę stylizację – jedno–dwa zdania. " +
      "2. Typ stylizacji – rodzaj aplikacji i czy jest efekt Anime/Spike. " +
      "3. Analiza techniczna – gęstość, kierunek, mapowanie, sklejenia, odrosty, klej. " +
      "4. Jakość wachlarzy (jeśli Volume/Mega) – krótka ocena. " +
      "5. Tryb Anime / Spike (jeśli dotyczy) – co jest dobre, co poprawić. " +
      "6. Najważniejsze wskazówki – 3–5 konkretnych porad dla stylistki. " +
      "Maksymalnie 12–15 zdań, bez lania wody. Bądź konkretny, pomocny i życzliwy. " +
      "Nie wymyślaj rzeczy, których na zdjęciu nie widać.";

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Przeanalizuj to zdjęcie rzęs zgodnie z zasadami powyżej.",
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    // Wyciąganie tekstu z odpowiedzi Responses API
    let analysis = "";

    if (response.output_text) {
      analysis = response.output_text;
    } else if (Array.isArray(response.output)) {
      analysis = response.output
        .flatMap((item) => item.content || [])
        .map((c) => c.text || "")
        .join("\n\n");
    }

    if (!analysis || !analysis.trim()) {
      analysis =
        "Analiza zakończona, ale model nie zwrócił szczegółowego raportu. Spróbuj wgrać wyraźniejsze zdjęcie jednego oka z bliska.";
    }

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Błąd w /analyze:", error);
    res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
      details: error.message,
    });
  }
});

// --- start serwera ---

app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
