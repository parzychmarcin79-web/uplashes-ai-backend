// generateMap.js – prosty router do mapki rzęs (wersja bez błędów)

const express = require("express");
const router = express.Router();

// Prosty endpoint POST /generate-map
// Na razie tylko zwraca tekst, bez prawdziwej logiki AI – ważne, żeby backend działał.
router.post("/generate-map", (req, res) => {
  res.json({
    ok: true,
    map: "Funkcja mapki rzęs będzie wkrótce włączona. Backend działa poprawnie.",
  });
});

module.exports = router;
