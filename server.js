// UPLashes AI – backend analizy zdjęć rzęs
// Plik: server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – plik w pamięci, max 8 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// Klient OpenAI – na Render musi być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prosty endpoint testowy – strona główna
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

// Endpoint do sprawdzania statusu z frontendu
app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// GŁÓWNY ENDPOINT ANALIZY
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    // 1. Sprawdzenie, czy jest plik
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Brak pliku obrazu. Upewnij się, że wysyłasz pole 'image'.",
      });
    }

    // 2. Język odpowiedzi – z frontendu przychodzi np. 'pl' lub 'en'
    const language = req.body.language === "en" ? "en" : "pl";

    // 3. Przygotowanie obrazu jako base64
    const mimeType = req.file.mimetype || "image/jpeg";
    const base64Image = req.file.buffer.toString("base64");
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    // 4. Prompt dla modelu – BEZ kombinowania z dodatkowymi warunkami
    const systemPrompt =
      language === "pl"
        ? `Jesteś ekspertem od stylizacji rzęs i instruktorem UPLashes.
Analizujesz zdjęcie stylizacji rzęs (przedłużanie rzęs).

Zawsze odpowiadaj po POLSKU.
Jeśli naprawdę na zdjęciu NIE ma oka z rzęsami (np. jest tylko tło, twarz z daleka itp.),
napisz uprzejmie: "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."

Jeśli rzęsy są widoczne, przeanalizuj stylizację według schematu:
1) GĘSTOŚĆ I OBJĘTOŚĆ – czy ilość rzęs jest wystarczająca, czy są dziury, przerwy, nierówna gęstość.
2) DŁUGOŚĆ I DOBÓR DO OKA – czy długość jest dobrana do oka i kondycji naturalnych rzęs, czy nie jest za ciężko.
3) KIERUNKOWANIE I MAPOWANIE – czy rzęsy idą w tym samym kierunku, czy mapowanie (np. kącik wewn., środek, zewn.) jest spójne.
4) JAKOŚĆ APLIKACJI – czy kępki są równe, czy nie ma sklejonych rzęs, czy są widoczne odstające kępki.
5) SUGESTIE POPRAWY – konkretne wskazówki, co stylistka może zrobić lepiej przy kolejnej aplikacji.

Pisz konkretnie, ale przyjaźnie – jak do stylistki, która chce się rozwijać.`
        : `You are a professional lash extensions expert and trainer for the UPLashes brand.
You analyse a photo of eyelash extensions.

Always answer in ENGLISH.
If the image truly does NOT contain an eye with lashes (e.g. only background, face from far away, etc.),
politely say: "I cannot clearly see an eye with lashes to analyse. Please upload a close-up photo of one eye."

If lashes are visible, analyse the set using this structure:
1) DENSITY & VOLUME – is the amount of lashes sufficient, are there gaps or uneven density.
2) LENGTH & SUITABILITY – is the length appropriate for the eye and natural lashes, is it too heavy.
3) DIRECTION & MAPPING – are the lashes going in the same direction, is the mapping (inner corner, middle, outer corner) consistent.
4) APPLICATION QUALITY – are the fans even, are there stickies, are there visible messy fans.
5) SUGGESTIONS – concrete tips what the stylist can improve next time.

Be specific and kind – like talking to a stylist who wants to grow.`;

    // 5. Wywołanie modelu OpenAI z obrazem
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                language === "pl"
                  ? "Oceń tę stylizację rzęs według schematu z promta."
                  : "Evaluate this lash set using the structure from the system prompt.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 700,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || "";

    if (!answer) {
      return res.status(500).json({
        ok: false,
        error: "Brak odpowiedzi z modelu.",
      });
    }

    // 6. Standardowa odpowiedź do frontendu
    return res.json({
      ok: true,
      analysis: answer,
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    return res.status(500).json({
      ok: false,
      error: "Wystąpił błąd podczas analizy zdjęcia.",
    });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`UPLashes AI backend nasłuchuje na porcie ${PORT}`);
});
