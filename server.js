// UPLashes AI – backend analizy zdjęć rzęs

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

// Upload w pamięci
const upload = multer({ storage: multer.memoryStorage() });

// PORT Render
const PORT = process.env.PORT || 10000;

// Klient OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint analizy zdjęcia
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak zdjęcia" });
    }

    const base64Image = req.file.buffer.toString("base64");

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Analyze eyelash extension photo." },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    res.json({
      success: true,
      analysis: response.output_text,
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`Backend działa na porcie ${PORT}`);
});
