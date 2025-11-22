// server.js – UPLashes AI backend (CommonJS, gotowy pod Render)
// UPLashes AI – analiza stylizacji rzęs

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Multer – trzymamy plik w pamięci
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // max 8 MB
});

// Klient OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prosty health-check
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// GŁÓWNY ENDPOINT ANALIZY
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    // 1. Sprawdzenie, czy przyszło zdjęcie
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Brak pliku ze zdjęciem (pole 'image').",
      });
    }

    // 2. Język z frontu (select) – "pl" albo "en"
    const language = (req.body.language || "pl").toLowerCase();

    // 3. Konwersja obrazu do data URL dla modelu
    const imageBase64 = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${imageBase64}`;

    // 4. PROMPTY – logika, o którą prosiłaś (czy jest stylizacja, jaka, albo rekomendacja)

    const systemPromptPl = `
Jesteś ekspertem UPLashes AI od stylizacji rzęs.
Analizujesz JEDNO zdjęcie. ZAWSZE trzymaj się tego schematu:

1. Najpierw sprawdź, czy na zdjęciu widać oko i rzęsy.
   - Jeśli NIE widać wyraźnie jednego oka z rzęsami (np. podłoga, twarz z daleka, bardzo rozmazane zdjęcie),
     odpowiedz KRÓTKO, że nie możesz ocenić stylizacji i poproś o wyraźne zdjęcie jednego oka z bliska.

2. Jeśli widać oko i rzęsy – oceń, czy są ZAŁOŻONE PRZEDŁUŻANE RZĘSY (stylizacja):
   a) Jeśli NIE ma stylizacji (tylko naturalne rzęsy):
      - POWIEDZ WPROST: nie widzisz założonych rzęs przedłużanych.
      - Opisz naturalne rzęsy (gęstość, kierunek, kształt oka, linia rzęs).
      - Zaproponuj 1–2 najlepiej pasujące rodzaje aplikacji:
        • Classic 1:1
        • Light Volume 2–3D
        • Volume 4–6D
        • Mega Volume 7D+
      - Krótko uzasadnij, dlaczego taki wybór pasuje do oka na zdjęciu.

   b) Jeśli SĄ przedłużane rzęsy:
      - Nazwij typ aplikacji:
        • Classic 1:1
        • Light Volume 2–3D
        • Volume 4–6D
        • Mega Volume 7D+
      - Jeśli możesz, podaj przybliżoną długość (np. 9–12 mm) i skręt (C, CC, D, L, LC itd.).
        Jeśli nie jesteś pewien – wyraźnie napisz, że to szacunek.
      - Oceń w punktach:
        • Gęstość i pokrycie
        • Kierunek i górna linia
        • Mapowanie i styl
        • Jakość przyklejenia
        • Bezpieczeństwo i komfort (zaczerwienienia, podrażnienia)

3. Na końcu daj 3–5 bardzo konkretnych wskazówek „Co możesz poprawić”.

Bądź konkretny, nie lej wody, nie wymyślaj rzeczy, których NIE widać na zdjęciu.
Gdy czegoś nie możesz ocenić – powiedz to wprost.
`.trim();

    const systemPromptEn = `
You are UPLashes AI – an expert lash stylist assistant.
You analyse ONE photo. ALWAYS follow this logic:

1. First check if there is a clear close-up of ONE eye with lashes.
   - If you do NOT clearly see an eye with lashes (floor, full face from far away, very blurry photo, etc.),
     reply with a SHORT message saying you cannot evaluate the styling and ask for a clear close-up of one eye.

2. If you can see the eye and lashes – detect whether there are EXTENSIONS:
   a) If there are NO extensions (only natural lashes):
      - SAY CLEARLY that you do not see any lash extensions.
      - Describe the natural lashes (density, direction, eye shape, lash line).
      - Recommend 1–2 best matching application types:
        • Classic 1:1
        • Light Volume 2–3D
        • Volume 4–6D
        • Mega Volume 7D+
      - Briefly explain why this choice fits the eye in the photo.

   b) If there ARE lash extensions:
      - Name the application type:
        • Classic 1:1
        • Light Volume 2–3D
        • Volume 4–6D
        • Mega Volume 7D+
      - If possible, estimate lengths (e.g. 9–12 mm) and curl (C, CC, D, L, LC, etc.).
        If you are not sure, explicitly say it is an estimate.
      - Evaluate in bullet points:
        • Density & coverage
        • Direction & top line
        • Mapping & style
        • Attachment quality
        • Safety & comfort (redness, irritation)

3. Finish with 3–5 very concrete “What you can improve” tips.

Be concise and focused. Do NOT invent details that are not visible.
If you cannot judge something, say it directly.
`.trim();

    const systemPrompt =
      language === "en" || language === "english" ? systemPromptEn : systemPromptPl;

    // 5. Wywołanie modelu
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                language === "en"
                  ? "Analyse these lashes according to the instructions."
                  : "Przeanalizuj te rzęsy zgodnie z instrukcją.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const message = completion.choices[0]?.message;
    let reportText = "";

    if (Array.isArray(message.content)) {
      reportText = message.content
        .filter((part) => part.type === "text" && part.text)
        .map((part) => part.text)
        .join("\n\n");
    } else {
      reportText = message.content || "";
    }

    return res.json({
      ok: true,
      report: reportText,
    });
  } catch (err) {
    console.error("Błąd /analyze:", err);
    return res.status(500).json({
      ok: false,
      error: "Błąd podczas analizy zdjęcia w AI.UPLashes.",
    });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`UPLashes AI backend listening on port ${PORT}`);
});
