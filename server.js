const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const upload = multer({ storage: multer.memoryStorage() });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nie wysłano zdjęcia." });
    }

    const base64Image = req.file.buffer.toString("base64");

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Przeanalizuj stylizację rzęs według profesjonalnych kryteriów.",
            },
            {
              type: "input_image",
              image_url: "data:image/jpeg;base64," + base64Image,
            },
          ],
        },
      ],
    });

    res.json({ analysis: response.output_text });

  } catch (err) {
    console.error("Błąd serwera:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend UPLashes działa na porcie ${PORT}`);
});
