// UPLashes AI – backend analizy zdjęć rzęs

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – zapis obrazu w pamięci
const upload = multer({ storage: multer.memoryStorage() });

// Klient OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// TEST: Render potrzebuje chociaż jedną trasę GET
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✔");
});

// 🔥 GŁÓWNY ENDPOINT ANALIZY
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak obrazu" });
    }

    // Konwersja pliku na Base64
    const base64Image = req.file.buffer.toString("base64");

    // 🔥 Zapytanie do OpenAI Vision
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: "data:image/jpeg;base64," + base64Image,
            },
            {
              type: "text",
              text: `
Przeanalizuj stylizację rzęs według schematu:

1) GĘSTOŚĆ I OBJĘTOŚĆ
2) KIERUNEK RZĘS
3) STYL I MAPA
4) TECHNIKA PRACY
5) JAK POPRAWIĆ?

Odpowiedź krótko i profesjonalnie.
              `,
            },
          ],
        },
      ],
    });

    const text = response.output_text;

    res.json({
      success: true,
      analysis: text,
    });
  } catch (error) {
    console.error("Błąd analizy:", error);
    res.status(500).json({ error: "Błąd podczas analizy obrazu" });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log("Serwer działa na porcie:", PORT);
});
