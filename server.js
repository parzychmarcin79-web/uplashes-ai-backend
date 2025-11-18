import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Upload handling
const upload = multer({ storage: multer.memoryStorage() });

// Model OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check
app.get("/", (req, res) => {
  res.send("UPLashes backend działa");
});

// AI ANALIZA
app.post("/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nie przesłano pliku." });
    }

    const { language } = req.body;

    const prompt = `
Jesteś ekspertem stylizacji rzęs.
Przeanalizuj zdjęcie według kluczowych punktów: gęstość, kierunki, dopasowanie długości, kształt, separator, wiązania, przejścia.
Udziel jasnych wskazówek poprawy.

Język odpowiedzi: ${language === "en" ? "English" : "Polski"}.
`;

    const base64Image = req.file.buffer.toString("base64");

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    const aiAnswer =
      response.output_text ||
      response.output[0]?.content[0]?.text ||
      "Brak odpowiedzi od modelu.";

    res.json({ result: aiAnswer });
  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({ error: "Błąd analizy AI.", details: error.message });
  }
});

// Port dla Render
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Backend UPLashes działa na porcie " + port);
});
