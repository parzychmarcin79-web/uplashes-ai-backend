// generateMap.js
// Router do generowania MAPY RZĘS – UPLashes

require("dotenv").config();

const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");

const router = express.Router();

// Multer – plik w pamięci (tak jak w głównym backendzie)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Klient OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Pomocnicza funkcja do wyciągania tekstu z odpowiedzi OpenAI
function extractTextFromMapResponse(response) {
  try {
    const firstItem = response.output[0];
    if (!firstItem || !firstItem.content) return "";
    const textPart = firstItem.content.find((c) => c.type === "output_text");
    if (!textPart || !textPart.content || !textPart.content[0]) return "";
    return textPart.content[0].text || "";
  } catch (e) {
    console.error("Błąd przy extractTextFromMapResponse:", e);
    return "";
  }
}

/**
 * POST /generate-map
 * Oczekuje:
 *  - multipart/form-data
 *  - pole "image" -> zdjęcie oka
 *  - pole "language" -> "pl" lub "en"
 */
router.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    const language = req.body.language === "en" ? "en" : "pl";

    if (!req.file) {
      return res.status(400).json({
        error: "Brak pliku ze zdjęciem. Wyślij zdjęcie w polu 'image'.",
      });
    }

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
      "base64"
    )}`;

    const systemPrompt =
      language === "pl"
        ? "Jesteś asystentem UPLashes. Na podstawie zdjęcia oka zaproponuj mapę rzęs: stylizacja, długości w poszczególnych strefach, skręt i grubość. Podaj to w formie krótkiej, czytelnej listy punktów. Na końcu dodaj krótką rekomendację produktów UPLashes (grubości, skręty). Nie pisz długiej analizy technicznej – tylko mapka + produkty."
        : "You are an assistant for UPLashes. From the eye photo, propose a lash map: style, lengths per zone, curl and thickness as a short bullet list. At the end add a short recommendation of UPLashes products (thickness, curls). Do not write a long technical analysis – just the map + products.";

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: systemPrompt },
            { type: "input_image", image_url: base64Image },
          ],
        },
      ],
    });

    let mapText = extractTextFromMapResponse(openaiResponse);

    if (!mapText) {
      mapText =
        language === "pl"
          ? "Analiza zakończona, ale nie udało się odczytać mapy z modelu. Spróbuj ponownie na innym zdjęciu."
          : "Analysis finished, but the model did not return a readable map. Please try another photo.";
    }

    return res.json({ map: mapText });
  } catch (error) {
    console.error("Błąd w /generate-map:", error);
    return res.status(500).json({
      error: "Błąd serwera podczas generowania mapy rzęs.",
      details: error.message || String(error),
    });
  }
});

// KLUCZOWE: eksportujemy *router*, a nie obiekt!
module.exports = router;
