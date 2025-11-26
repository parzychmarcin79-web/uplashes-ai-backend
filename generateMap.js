// generateMap.js – prosty router do mapki rzęs (wersja startowa)

const express = require("express");
const multer = require("multer");

const router = express.Router();

// Multer – trzymamy plik w pamięci (tak samo jak w server.js)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// POST /generate-map
router.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    const language = req.body.language || "pl";

    if (!req.file) {
      return res.status(400).json({
        error: "Brak zdjęcia do analizy. Wgraj zdjęcie i spróbuj ponownie.",
      });
    }

    // 👉 Na razie ZAMIENNIK – bez OpenAI.
    // Później w to miejsce wstawimy wywołanie AI,
    // teraz ważne, żeby backend działał i nie wywalał deploya.

    if (language === "pl") {
      return res.json({
        map:
          "Przykładowa propozycja mapki rzęs (wersja testowa):\n" +
          "- Kącik wewnętrzny: 7–8 mm, skręt CC, delikatne zagęszczenie.\n" +
          "- Strefa środkowa: 9–10 mm, skręt CC/D, większa gęstość.\n" +
          "- Kącik zewnętrzny: 8–9 mm, skręt CC, miękkie wyciągnięcie oka.\n" +
          "\nTo jest wariant przykładowy – docelowo w tym miejscu " +
          "aplikacja AI wygeneruje mapkę dopasowaną do zdjęcia.",
      });
    } else {
      return res.json({
        map:
          "Sample lash map (test version):\n" +
          "- Inner corner: 7–8 mm, CC curl, light density.\n" +
          "- Middle zone: 9–10 mm, CC/D curl, higher density.\n" +
          "- Outer corner: 8–9 mm, CC curl, soft eye extension.\n" +
          "\nThis is only a placeholder – later AI will generate a " +
          "personalized map based on the photo.",
      });
    }
  } catch (err) {
    console.error("Błąd w /generate-map:", err);
    return res.status(500).json({
      error: "Błąd serwera podczas generowania mapki rzęs.",
      details: err.message || String(err),
    });
  }
});

module.exports = router;
