// UPLashes AI – backend analizy zdjęć rzęs (CommonJS)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – trzymamy plik w pamięci, limit 8 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// Klient OpenAI – pamiętaj o zmiennej OPENAI_API_KEY na Render
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prosty healthcheck
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// Funkcja budująca instrukcję dla modelu – PL/EN
function buildPrompt(language) {
  if (language === "en") {
    return `
You are an expert lash stylist and trainer. Analyze the lash extension work on this photo.

1) DENSITY AND COVERAGE
- Is the lash line well covered, or do you see gaps or sparse areas?
- Does density match the chosen effect (natural / light volume / mega volume)?

2) DIRECTION AND TOP LINE
- Are lashes parallel and directed correctly?
- Is the top line smooth and even?

3) MAPPING AND STYLE
- What style do you see (e.g. doll eye, cat eye, fox, eyeliner)?
- Does the mapping look consistent on the whole eye?

4) ATTACHMENT QUALITY
- Do you see stickies, clumps or twisted fans?
- Are the bases neat and well wrapped?

5) HEALTH & SAFETY
- Do you see redness, swelling or irritation on the eyelid?
- Are lashes too heavy for the natural lashes?

Give a short, clear analysis (max 10–12 sentences) plus 3–5 practical tips for improvement. Keep the tone kind but honest.`;
  }

  // domyślnie polski
  return `
Jesteś ekspertem od stylizacji rzęs i instruktorem. Na podstawie zdjęcia przeanalizuj stylizację rzęs.

1) GĘSTOŚĆ I POKRYCIE
- Czy linia rzęs jest dobrze pokryta, czy widać luki lub bardzo rzadkie miejsca?
- Czy gęstość pasuje do wybranego efektu (naturalny / light volume / mega volume)?

2) KIERUNEK I GÓRNA LINIA
- Czy rzęsy są ustawione w podobnym kierunku, bez „krzyżowania się”?
- Czy górna linia rzęs jest równa i estetyczna?

3) MAPOWANIE I STYL
- Jaki styl widzisz (np. doll eye, kocie oko, fox, eyeliner)?
- Czy długości są rozłożone spójnie na całym oku?

4) JAKOŚĆ PRZYKLEJENIA
- Czy widać sklejenia, posklejane kępki lub skręcone wachlarzyki?
- Czy podstawy są czyste i dobrze otulają rzęsę naturalną?

5) BEZPIECZEŃSTWO I KOMFORT
- Czy widać zaczerwienienie, opuchliznę lub podrażnienie powieki?
- Czy rzęsy nie wyglądają na zbyt ciężkie dla rzęs naturalnych?

Zrób krótką, konkretną analizę (maksymalnie 10–12 zdań) oraz wypisz 3–5 praktycznych wskazówek, jak poprawić pracę. Ton: wspierający, ale szczery.`;
}

// Główna trasa analizy – UWAGA: pole pliku **musi** nazywać się "image"
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    // Brak pliku
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Brak pliku. Wyślij zdjęcie w polu 'image'.",
      });
    }

    const language = req.body.language === "en" ? "en" : "pl";
    const prompt = buildPrompt(language);

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Jesteś doświadczoną stylistką rzęs i instruktorem. Oceniasz jakość aplikacji na podstawie zdjęć i dajesz bardzo konkretne wskazówki.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content || "";

    res.json({
      ok: true,
      answer,
    });
  } catch (err) {
    console.error("Error in /analyze:", err);
    res.status(500).json({
      ok: false,
      error: "Błąd po stronie serwera podczas analizy zdjęcia.",
    });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
