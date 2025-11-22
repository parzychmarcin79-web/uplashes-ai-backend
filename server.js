// UPLashes AI – backend analizy zdjęć rzęs (endpoint /analyze)
// Plik: server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Klient OpenAI – pamiętaj o ustawieniu zmiennej OPENAI_API_KEY w Render
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Konfiguracja multer – plik w pamięci, max 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Endpoint testowy
app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

// Główny endpoint analizy zdjęcia rzęs
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak pliku ze zdjęciem." });
    }

    const mimeType = req.file.mim
