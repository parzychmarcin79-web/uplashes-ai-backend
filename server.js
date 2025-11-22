// UPLashes AI – backend analizy zdjęć rzęs
// Wersja stabilna – gotowa do Render

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – przechowywanie plików w RAM
const upload = multer({ storage: multer.memoryStorage() });

// Klient OpenAI – Render pobierze OPENAI_API_KEY z Environmental Variables
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// TEST endpoint
app.get("/ping", (req, res) => {
  res.json({ status: "UPLashes backend działa poprawnie" });
});

// ANALIZA ZDJĘCIA – główny endpoint
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak zdjęcia" });
    }

    // Konwersja zdjęcia do Base64
    const base64Image = req.file.buffer.toString("base64");

    // Zapytanie do GPT-4o Vision
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
Przeanalizuj stylizację rzęs według schematu:

1) GĘSTOŚĆ I OBJĘTOŚĆ
- Czy ilość rzęs jest wystarczająca?
- Czy są widoczne przerwy?

2) KIERUNEK I SYMETRIA
- Czy rzęsy są równe i skierowane w jednym kierunku?

3) PRZYCZEPIENIE I KĄT
- Czy kępki są poprawnie zaczepione?

4) STAN NATURALNYCH RZĘS
- Czy są oznaki uszkodzeń?

Na końcu dodaj:
- KRÓTKIE PODSUMOWANIE
- 3 REKOMENDACJE UPLashes (np. klej, bonder, typ rzęs)
              `,
            },
            { 
              type: "input_image",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              }
            }
          ],
        },
      ],
      max_tokens: 500,
    });

    const analysis = response.choices?.[0]?.message?.content || "Brak odpowiedzi";

    res.json({ success: true, analysis });

  } catch (error) {
    console.error("Błąd analizy:", error);
    res.status(500).json({ error: "Błąd przetwarzania zdjęcia" });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
