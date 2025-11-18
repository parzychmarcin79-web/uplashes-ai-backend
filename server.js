const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

// Prosta trasa testowa — Render musi to widzieć
app.get("/", (req, res) => {
  res.send("UPLashes backend działa");
});

// Główna trasa do analizy obrazu
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak pliku" });
    }

    // ZWROT TESTOWY — tutaj potem podłączymy AI
    return res.json({
      analysis: "Analiza testowa działa — serwer online."
    });

  } catch (err) {
    return res.status(500).json({ error: "Błąd serwera", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend UPLashes działa na porcie " + PORT));
