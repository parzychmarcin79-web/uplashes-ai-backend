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

// PROSTY LICZNIK ANALIZ
let analysisCounter = 0;
// Opcjonalny „limit” – ustaw np. MAX_ANALYSES=500 w Render, jak chcesz mieć informację „ile zostało”
const MAX_ANALYSES = process.env.MAX_ANALYSES
  ? parseInt(process.env.MAX_ANALYSES, 10)
  : null;

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
      analysisCounter,
      remainingAnalyses:
        MAX_ANALYSES != null
          ? Math.max(MAX_ANALYSES - analysisCounter, 0)
          : null
    });
  }

  return res.json({
    status: "live",
    message: "UPLashes AI backend działa poprawnie.",
    analysisCounter,
    remainingAnalyses:
      MAX_ANALYSES != null
        ? Math.max(MAX_ANALYSES - analysisCounter, 0)
        : null
  });
});

/**
 * ENDPOINT ANALIZY ZDJĘCIA
 * POST /analyze
 * body: {
 *   imageBase64: string,
 *   language: "pl" | "en",
 *   reportMode?: "standard" | "detailed" | "pro",
 *   overrideType?: "natural" | "extensions" | "lift" | "auto"
 * }
 */
app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, language, reportMode, overrideType } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Brak obrazu w polu imageBase64."
      });
    }

    const lang = language === "en" ? "en" : "pl";
    const mode =
      reportMode === "detailed" || reportMode === "pro"
        ? reportMode
        : "standard";

    // overrideType może wskazać na natural / extensions / lift albo być ignorowane, jeśli "auto" / coś innego
    const override =
      overrideType === "natural" ||
      overrideType === "extensions" ||
      overrideType === "lift"
        ? overrideType
        : null;

    // Główna logika jest w classify.js
    const data = await analyzeEye(imageBase64, lang, mode, override);

    if (!data || data.status !== "success") {
      return res.status(500).json(
        data || {
          status: "error",
          message: "Nie udało się przeprowadzić analizy."
        }
      );
    }

    // Zwiększamy licznik udanych analiz
    analysisCounter += 1;
    const remaining =
      MAX_ANALYSES != null
        ? Math.max(MAX_ANALYSES - analysisCounter, 0)
        : null;

    return res.json({
      ...data,
      analysisCounter,
      remainingAnalyses: remaining
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
