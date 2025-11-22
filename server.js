// --- UPLashes AI Backend ---
// Pełny gotowy plik server.js (CJS + Render kompatybilny)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Upload pliku do pamięci
const upload = multer({ storage: multer.memoryStorage() });

// Klient OpenAI (Render: dodaj OPENAI_API_KEY w Environment Variables)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Testowy endpoint — musi działać! 🔥
app.get("/ping", (req, res) => {
  res.json({ status: "UPLashes AI backend działa poprawnie!" });
});

// Endpoint analizy zdjęcia rzęs
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak obrazu" });
    }

    const imageBase64 = req.file.buffer.toString("base64");

    // 🔥 ANALIZA OBRAZU — GPT-4o
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${imageBase64}`,
            },
            {
              type: "text",
              text: `
Przeanalizuj stylizację rzęs według schematu:

1) GĘSTOŚĆ I OBJĘTOŚĆ  
2) KIERUNEK  
3) SYMETRIA  
4) DOPASOWANIE  
5) OGÓLNA JAKOŚĆ

Zwróć odpowiedź w bardzo profesjonalnym stylu.
              `,
            },
          ],
        },
      ],
      max_tokens: 400,
    });

    res.json({
      success: true,
      analysis: response.choices[0].message.content,
    });
  } catch (error) {
    console.error("Błąd analizy:", error);
    res.status(500).json({ error: "Błąd serwera analizy" });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log("UPLashes AI backend działa na porcie:", PORT);
});
