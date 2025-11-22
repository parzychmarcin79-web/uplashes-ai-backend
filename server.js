// UPLashes AI – backend analizy zdjęć rzęs (CommonJS, bez "type": "module")
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – plik w pamięci, limit 8 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// Klient OpenAI – na Render musi być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prosty health-check, żeby nie było "Cannot GET /"
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * GŁÓWNY ENDPOINT DO ANALIZY ZDJĘCIA
 * Oczekuje:
 *  - field "image" (plik)
 *  - body.language: "pl" lub "en"
 *  - body.analysisType: "before" albo "after"
 */
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nie przesłano pliku." });
    }

    const { language = "pl", analysisType = "after" } = req.body;

    const base64Image = req.file.buffer.toString("base64");
    const langLabel = language === "en" ? "English" : "Polski";

    const systemPrompt = `
Jesteś bardzo doświadczoną stylistką rzęs i instruktorką.
Analizujesz zdjęcia oka i dajesz jasny, profesjonalny feedback dla stylistek.
Odpowiadasz zawsze w języku: ${langLabel}.
`;

    const userPrompt = `
Analizujemy zbliżenie jednego oka do stylizacji rzęs.

BARDZO WAŻNE – TRZYMAJ SIĘ ŚCISŁO TYCH ZASAD:

1) NAJPIERW SPRAWDŹ, CZY ZDJĘCIE JEST POPRAWNE:
   - Poprawne = zbliżenie JEDNEGO oka, widoczna linia rzęs/naskórek.
   - Jeśli na zdjęciu NIE ma oka z rzęsami (np. podłoga, ściana, przypadkowy obiekt, tekst, twarz bez oka):
     -> Odpowiedz TYLKO krótką wiadomością:
        "${
          language === "en"
            ? "I can't see an eye with lashes to analyze. Please upload a close-up photo of one eye."
            : "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
        }"
     -> NIE wymyślaj analizy rzęs.

2) JEŚLI ZDJĘCIE JEST POPRAWNE – ZRÓB PEŁNĄ ANALIZĘ.

   - analysisType = "before":
     Traktuj to jako analizę PRZED APLIKACJĄ.
     Oceń:
       • długość i gęstość naturalnych rzęs,
       • kształt oka i powieki,
       • kierunek wzrostu i kondycję rzęs.
     Następnie podaj:
       • rekomendowane mapowanie (długości, skręty, grubości, efekt),
       • propozycje efektu (naturalny, doll eye, fox, itp.),
       • ostrzeżenia (jeśli rzęsy są bardzo słabe/krótkie/zniszczone),
       • praktyczne tipy dla stylistki przed aplikacją.

   - analysisType = "after":
     Traktuj to jako ocenę GOTOWEJ PRACY.
     Oceń:
       • gęstość i równomierność,
       • kierunki i symetrię (wewnętrzne/zewnętrzne kąciki),
       • odległość od skóry, czystość przyklejenia,
       • jakość kępek (przy objętościach),
       • dopasowanie efektu do anatomii oka.
     Następnie podaj:
       • największe plusy,
       • najważniejsze błędy,
       • jasne sugestie, jak poprawić kolejną stylizację.

3) STYL:
   - Bądź uprzejma, ale konkretna.
   - Używaj punktów, krótkich sekcji i języka zrozumiałego dla stylistek.
   - Pisz w języku: ${langLabel}.
`;

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
            { type: "input_text", text: userPrompt },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    // Wyciągnięcie tekstu z odpowiedzi
    let analysis =
      response.output_text ||
      (response.output &&
        Array.isArray(response.output) &&
        response.output
          .flatMap((item) => item.content || [])
          .map((c) => c.text)
          .join("\n\n")) ||
      "Brak odpowiedzi od modelu.";

    res.json({ analysis, result: analysis });
  } catch (error) {
    console.error("SERVER ERROR /analyze:", error);
    res.status(500).json({
      error: "Błąd analizy AI.",
      details: error.message,
    });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log("Backend UPLashes AI działa na porcie " + PORT);
});
