// server.js – UPLashes AI – analiza stylizacji rzęs

const express = require("express");
const cors = require("cors");
const { analyzeEye } = require("./classify");

const app = express();

// Podstawowe middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // pozwala na duże base64

// PORT z Render / lokalnie domyślnie 10000
const PORT = process.env.PORT || 10000;

// Wersja backendu i prosty licznik analiz
const BACKEND_VERSION = "1.1.0";
let analysisCounter = 0;

// Sprawdzenie klucza OpenAI (używane w /status)
function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");
    return false;
  }
  return true;
}

/**
 * ENDPOINT STATUS – do sprawdzania czy backend żyje
 * GET /status  →  { status: "live" } lub błąd, jeśli brak klucza
 */
app.get("/status", (req, res) => {
  if (!ensureApiKey()) {
    return res.status(500).json({
      status: "error",
      message: "Brak klucza OPENAI_API_KEY po stronie serwera.",
      version: BACKEND_VERSION
    });
  }

  return res.json({
    status: "live",
    message: "UPLashes AI backend działa poprawnie.",
    version: BACKEND_VERSION,
    analysisCounter
  });
});

/**
 * ENDPOINT ANALIZY ZDJĘCIA
 * POST /analyze
 * body: {
 *   imageBase64: string,
 *   language?: "pl" | "en",
 *   mode?: "standard" | "detailed" | "pro",
 *   setType?: "auto" | "natural" | "extensions" | "lift"
 * }
 */
app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, language, mode, setType } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Brak obrazu w polu imageBase64."
      });
    }

    // Prosty limit długości base64 (żeby ktoś nie wrzucał giganta)
    const maxLength = 15 * 1024 * 1024; // ~15 MB base64
    if (imageBase64.length > maxLength) {
      return res.status(413).json({
        status: "error",
        message: "Obraz jest zbyt duży do analizy."
      });
    }

    const lang = language === "en" ? "en" : "pl";

    // Tryb raportu – na razie tylko informacyjnie (logika jest w classify.js)
    const allowedModes = ["standard", "detailed", "pro"];
    const safeMode = allowedModes.includes(mode) ? mode : "standard";

    // Typ zestawu – na razie informacyjnie (klasyfikację robi analyzeEye)
    const allowedSetTypes = ["auto", "natural", "extensions", "lift"];
    const safeSetType = allowedSetTypes.includes(setType)
      ? setType
      : "auto";

    // Główna logika jest w classify.js
    const data = await analyzeEye(imageBase64, lang);

    // Zwiększamy licznik tylko dla udanych analiz
    if (data && data.status === "success") {
      analysisCounter++;
    }

    // Doklejamy info o trybie i typie, żeby front mógł je pokazać
    return res.json({
      ...data,
      mode: safeMode,
      setType: safeSetType
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return res.status(500).json({
      status: "error",
      message: "Błąd serwera analizy."
    });
  }
});

// Fallback na nieistniejące endpointy
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint nie istnieje."
  });
});

// Start serwera
app.listen(PORT, () => {
  console.log(`UPLashes AI backend nasłuchuje na porcie ${PORT}`);
});

module.exports = app;
