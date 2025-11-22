// UPLashes AI – backend analizy zdjęć rzęs
// Plik: server.js (wersja CommonJS, gotowa pod Render)

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---

app.use(cors());
app.use(express.json());

// Multer – zapis pliku w pamięci, akceptujemy dowolną nazwę pola (upload.any)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Klient OpenAI – na Render musi być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Proste endpointy pomocnicze ---

app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// --- Główny endpoint analizy zdjęcia rzęs ---

app.post("/analyze", upload.any(), async (req, res) => {
  try {
    // 1) Pobieramy plik – pierwszy załączony
    const file = (req.files && req.files[0]) || null;

    if (!file) {
      return res.status(400).json({
        ok: false,
        error: "Brak pliku ze zdjęciem. Wyślij zdjęcie oka w polu formularza.",
      });
    }

    // 2) Język odpowiedzi – domyślnie polski
    const lang = req.body.language === "en" ? "en" : "pl";

    const imageBase64 = file.buffer.toString("base64");

    // 3) Prompty dla modelu

    const systemPrompt =
      lang === "pl"
        ? "Jesteś wirtualną stylistką rzęs UPLashes AI. Oceniasz stylizacje rzęs na podstawie zdjęcia klientki."
        : "You are a virtual lash stylist called UPLashes AI. You analyse lash sets based on a client's photo.";

    const userPrompt =
      lang === "pl"
        ? `Przeanalizuj bardzo dokładnie zdjęcie oka.

KROKI:

1. Najpierw sprawdź, czy na zdjęciu w ogóle widać wyraźne ZBLIŻENIE jednego oka z rzęsami.
   - Jeśli NIE ma wyraźnego oka z rzęsami (np. jest twarz z daleka, podłoga, zwierzę, ekran itp.),
     odpowiedz TYLKO jednym krótkim raportem:
     "Nie widzę wyraźnego oka z rzęsami na zdjęciu. Wgraj proszę zbliżenie jednego oka, bez filtra, dobrze oświetlone."
     I NIC WIĘCEJ nie dopisuj.

2. Jeśli widać oko z rzęsami, zdecyduj:
   - czy widać PRZEDŁUŻANE rzęsy (sztuczne rzęsy),
   - czy to tylko naturalne rzęsy bez aplikacji.

3A. Jeżeli widać PRZEDŁUŻANE rzęsy:
   - określ typ aplikacji (wybierz JEDNO z poniższych i użyj dokładnie takiego nazewnictwa):
     • klasyczna 1:1
     • light volume 2–3D
     • volume 4–5D
     • mega volume 6D+
   - oceń w osobnych punktach:
     • gęstość i pokrycie,
     • kierunek i górna linia,
     • mapowanie i styl (rodzaj efektu),
     • jakość przyklejenia (czy są sklejenia, odstające rzęsy itp.),
     • bezpieczeństwo i komfort (podrażnienia, zaczerwienienia),
     • ogólne wrażenie stylizacji.
   - podaj 3–6 KONKRETNYCH wskazówek, co można poprawić (np. zmiana grubości, skrętu, rozłożenia długości).

3B. Jeżeli NIE widać przedłużanych rzęs (widać tylko naturalne):
   - jasno napisz, że to naturalne rzęsy bez aplikacji.
   - zaproponuj 2–3 typy stylizacji, które mogłyby dobrze pasować do tego oka
     (np. klasyczna 1:1, light volume 2–3D, lash lift),
   - krótko wyjaśnij DLACZEGO te opcje będą dobre.

FORMA ODPOWIEDZI:
- używaj nagłówków i wypunktowań,
- maksymalnie 10 krótkich punktów,
- całą odpowiedź napisz po polsku.`
        : `Carefully analyse the uploaded eye photo.

STEPS:

1. First check if the image contains a CLEAR CLOSE-UP of a single eye with lashes.
   - If you CANNOT clearly see an eye with lashes (for example it's a full face from far away, a floor,
     an animal, a screen, etc.), reply with ONE short report only:
     "I can't clearly see an eye with lashes in this photo. Please upload a close-up of one eye, well lit, without filters."
     Do NOT add anything else.

2. If you do see an eye with lashes, decide:
   - whether there are EYELASH EXTENSIONS applied,
   - or it's only natural lashes with no extensions.

3A. If there ARE EXTENSIONS:
   - classify the set as exactly ONE of:
     • classic 1:1
     • light volume 2–3D
     • volume 4–5D
     • mega volume 6D+
   - evaluate in separate bullet points:
     • density and coverage,
     • direction and top line,
     • mapping and style (overall effect),
     • attachment quality (stickies, loose fans, placement),
     • safety and comfort (redness, irritation),
     • overall impression of the set.
   - give 3–6 specific improvement tips (e.g. change of thickness, curl, mapping, length placement).

3B. If there are NO extensions (only natural lashes):
   - clearly say these are natural lashes with no extensions,
   - suggest 2–3 application types that could suit this eye
     (for example classic 1:1, light volume 2–3D, lash lift),
   - briefly explain WHY these options would work well.

ANSWER FORMAT:
- use headings and bullet points,
- maximum 10 short bullet points,
- write the entire answer in ${lang === "pl" ? "Polish" : "English"}.`;

    // 4) Wywołanie modelu z obrazem
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${imageBase64}`,
            },
          ],
        },
      ],
    });

    const assistantMessage = completion.choices[0]?.message;

    let text = "";

    if (assistantMessage) {
      if (Array.isArray(assistantMessage.content)) {
        text = assistantMessage.content
          .filter((block) => block.type === "text" && block.text)
          .map((block) => block.text)
          .join("\n");
      } else if (typeof assistantMessage.content === "string") {
        text = assistantMessage.content;
      }
    }

    if (!text || !text.trim()) {
      return res.status(500).json({
        ok: false,
        error: "Model nie zwrócił treści analizy.",
      });
    }

    res.json({
      ok: true,
      analysis: text.trim(),
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    res.status(500).json({
      ok: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
    });
  }
});

// --- Start serwera ---

app.listen(PORT, () => {
  console.log(`UPLashes AI backend listening on port ${PORT}`);
});
