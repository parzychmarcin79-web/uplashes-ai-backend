// UPLashes AI – backend analizy zdjęć rzęs
// Wersja ES Module (działa z "type": "module" w package.json)

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – plik w pamięci
const upload = multer({ storage: multer.memoryStorage() });

// Klient OpenAI – pamiętaj o zmiennej OPENAI_API_KEY na Render
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prosty root – żeby nie było "Cannot GET /"
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

// /ping – szybki test zdrowia serwera
app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

/**
 * GŁÓWNY ENDPOINT DO ANALIZY ZDJĘCIA
 * POST /analyze
 * - field "image" (plik)
 * - body.language: "pl" lub "en"
 * - body.analysisType: "before" albo "after"
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
Jesteś doświadczoną stylistką rzęs i instruktorem.
Analizujesz zdjęcie oka i dajesz konkretne, profesjonalne wskazówki dla stylistek.
Zawsze odpowiadasz w języku: ${langLabel}.
`;

    const userPrompt = `
Analizujemy zbliżenie jednego oka pod kątem stylizacji rzęs.

BARDZO WAŻNE – ZASADY:

1) Najpierw sprawdź, czy zdjęcie jest poprawne:
   - Poprawne = zbliżenie JEDNEGO oka, widać rzęsy (naturalne lub przedłużane),
     linię rzęs i powiekę.
   - Jeśli NIE widać oka z rzęsami (np. podłoga, ściana, tekst, przedmiot):
     -> Odpowiedz tylko krótką wiadomością:
        "${language === "en"
          ? "I can't see an eye with lashes to analyze. Please upload a close-up photo of one eye."
          : "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
        }"
     -> NIE wymyślaj żadnej analizy stylizacji.

2) Jeśli zdjęcie jest poprawne – pełna analiza.

   analysisType = "before":
   - Traktuj jako konsultację PRZED aplikacją.
   - Oceń:
       • długość i gęstość naturalnych rzęs,
       • kształt oka i powieki,
       • kierunek rzęs, ich kondycję.
   - Podaj:
       • rekomendowane skręty, długości, grubości i efekt (np. natural, doll, fox),
       • ostrzeżenia, jeśli rzęsy są słabe/zniszczone,
       • praktyczne wskazówki dla stylistki przed aplikacją.

   analysisType = "after":
   - Traktuj jako ocenę WYKONANEJ stylizacji.
   - Oceń:
       • gęstość i równomierność,
       • kierunki i symetrię (wewn./zewn. kącik),
       • odległość od skóry, czystość aplikacji,
       • jakość kępek (przy volume),
       • czy efekt pasuje do budowy oka.
   - Podaj:
       • największe plusy,
       • najważniejsze błędy,
       • konkretne wskazówki, jak poprawić kolejną aplikację.

3) Styl:
   - bądź życzliwa, ale konkretna,
   - używaj wypunktowań i krótkich sekcji,
   - pisz w języku: ${langLabel}.
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
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
