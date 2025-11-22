// UPLashes AI – backend analizy zdjęć rzęs
// Plik: server.js (wersja CommonJS – const require)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – plik w pamięci
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Klient OpenAI – na Render musi być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// PROSTE ENDPOINTY TESTOWE – żeby nie było "Cannot GET /"
app.get("/", (req, res) => {
  res.send("UPLashes AI backend – OK");
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "UPLashes AI backend – ping OK" });
});

/**
 * GŁÓWNY ENDPOINT DO ANALIZY ZDJĘCIA
 * Oczekuje:
 *  - pole "image" (plik)
 *  - body.language: "pl" lub "en" (opcjonalne, domyślnie "pl")
 *  - body.analysisType: "before" albo "after" (opcjonalne, domyślnie "after")
 */
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nie przesłano pliku." });
    }

    const { language = "pl", analysisType = "after" } = req.body;

    const base64Image = req.file.buffer.toString("base64");
    const langLabel = language === "en" ? "English" : "Polski";

    const systemPrompt = `
You are a highly experienced lash stylist and educator.
You analyze eye photos and give clear, professional feedback tailored for lash stylists.
Always answer in the requested language: ${langLabel}.
`;

    const userPrompt = `
We are analyzing a close-up eye photo for lash styling.

VERY IMPORTANT – FOLLOW THESE RULES STRICTLY:

1) FIRST CHECK IF THE PHOTO IS VALID:
   - Valid photo = close-up of ONE eye with natural lashes or lash extensions,
     clearly visible lash line and eyelid.
   - If the photo does NOT show an eye with lashes (for example: floor, wall,
     face without visible eye, text, random object, etc.):
     -> Answer ONLY with a short message like:
        "${
          language === "en"
            ? "I can't see an eye with lashes to analyze. Please upload a close-up photo of one eye."
            : "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
        }"
     -> Do NOT invent any lash analysis in this case.

2) IF THE PHOTO IS VALID – DO A FULL ANALYSIS.
   Use the requested analysis type:

   - analysisType = "before":
     Treat this as a PRE-APPLICATION consultation.
     Look mainly at:
       • natural lash length and density,
       • eye and eyelid shape,
       • lash direction and health.
     Then give:
       • recommended mapping (lengths, curls, thickness, effect),
       • suggestions for styling (e.g. natural, doll eye, fox, etc.),
       • warnings (if lashes are weak, very short, damaged),
       • practical tips for stylist before application.

   - analysisType = "after":
     Treat this as an evaluation of DONE WORK.
     Look at:
       • density and evenness,
       • directions and symmetry (inner/outer corners),
       • attachment area (distance from skin, neatness),
       • fans quality (for volume),
       • overall effect vs. natural anatomy of the eye.
     Then give:
       • biggest pluses,
       • most important mistakes,
       • clear suggestions how to improve next set.

3) STYLE:
   - Be kind but concrete – this is feedback for a lash stylist.
   - Use bullet points and short sections.
   - Write in ${langLabel}.
`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    // Wyciągamy tekst z odpowiedzi
    let analysis =
      response.output_text ||
      (response.output &&
        Array.isArray(response.output) &&
        response.output
          .flatMap((item) => item.content || [])
          .map((c) => c.text || "")
          .join("\n\n")) ||
      "Brak odpowiedzi od modelu.";

    // Zwracamy w dwóch polach, żeby pasowało do starego frontu
    res.json({ success: true, analysis, result: analysis });
  } catch (error) {
    console.error("SERVER ERROR /analyze:", error);
    res.status(500).json({
      success: false,
      error: "Błąd analizy AI.",
      details: error.message,
    });
  }
});

// Fallback na nieistniejące ścieżki
app.use((req, res) => {
  res.status(404).json({ error: "Taki endpoint nie istnieje." });
});

// Start serwera
app.listen(PORT, () => {
  console.log("Backend UPLashes AI działa na porcie " + PORT);
});
