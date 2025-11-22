// UPLashes AI – backend analizy zdjęć rzęs (pełna wersja A+B+C)

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 10000;

// OpenAI client (Responses API)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----------------------
// STATUS ENDPOINT
// ----------------------
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

// ----------------------
// GŁÓWNY ENDPOINT ANALIZY
// ----------------------
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak zdjęcia." });
    }

    const base64Image = req.file.buffer.toString("base64");

    // ----------------------
    // POPRAWNY PROMPT
    // ----------------------
    const prompt = `
Jesteś ekspertem UPLashes AI od zaawansowanej analizy stylizacji rzęs na zdjęciach.
Pisz po polsku, profesjonalnie, krótko i konkretnie. Oceniasz JEDNO zdjęcie jednego oka.

-------------------------------------
KROK 1 – CZY ZDJĘCIE JEST PRAWIDŁOWE?
-------------------------------------
Jeśli:
- nie widać oka,
- zdjęcie jest za daleko,
- widać twarz, podłogę, cokolwiek innego,

NAPISZ TYLKO:
"Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."

-------------------------------------
KROK 2 – CZY NA RZĘSACH JEST APLIKACJA?
-------------------------------------
Jeśli są NATURALNE rzęsy:
- oceń ich gęstość, długość, kierunki,
- zaproponuj 1–2 typy aplikacji pasujące do oka.

Jeśli jest APLIKACJA:
- ustal typ:
  • klasyczna 1:1
  • light volume 2–3D
  • volume 4–6D
  • mega volume 7D+
- oceń, czy efekt przypomina:
  • naturalny
  • delikatny volume
  • mocny volume
  • anime/spike (charakterystyczne kolce)

-------------------------------------
KROK 3 – ZAawansowana ANALIZA (A)
-------------------------------------
Oceń:
1. Gęstość i pokrycie linii rzęs (czy są luki?)
2. Kierunki i równoległość rzęs
3. Mapowanie i płynność długości
4. Sklejone rzęsy (czy widać separację?)
5. Odrosty – czy aplikacja jest świeża?
6. Klej – czy są grudki / nadmiar?

-------------------------------------
KROK 4 – Mega Volume (B – jeśli dotyczy)
-------------------------------------
Jeśli stylizacja wygląda na Volume lub Mega Volume:
- oceń jakość wachlarzy:
  • symetria
  • rozłożenie
  • ciężkość do naturalnych rzęs
  • jakość podstaw

Jeśli to NIE Volume:
Napisz: "B) Mega Volume: nie dotyczy."

-------------------------------------
KROK 5 – Anime / Spike (C – jeśli dotyczy)
-------------------------------------
Jeśli widać kolce / spikes:
- oceń rozmieszczenie,
- gładkość,
- kontrast z tłem volume.

Jeśli nie:
Napisz: "C) Anime / Spike Lashes: nie dotyczy."

-------------------------------------
FORMAT ODPOWIEDZI:
-------------------------------------
Zwróć raport w tej strukturze:

### AI.UPLashes REPORT

1. **Czy widzę stylizację?**
2. **Typ stylizacji**
3. **Analiza techniczna**
4. **Jakość wachlarzy (jeśli dotyczy)**
5. **Tryb Anime / Spike (jeśli dotyczy)**
6. **Wskazówki do poprawy (3–5 punktów)**

Bądź konkretny, techniczny, ale życzliwy. Nie wymyślaj rzeczy niewidocznych.
`;

    // ----------------------
    // REQUEST DO OPENAI RESPONSES API
    // ----------------------
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

    // ----------------------
    // WYCIĄGANIE TEKSTU
    // ----------------------
    let analysis = "";

    if (response.output_text) {
      analysis = response.output_text;
    } else if (Array.isArray(response.output)) {
      analysis = response.output
        .flatMap((item) => item.content || [])
        .map((c) => c.text || "")
        .join("\n\n");
    } else {
      analysis = "Brak odpowiedzi od modelu.";
    }

    res.json({ success: true, analysis });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
      details: err.message,
    });
  }
});

// ----------------------
// START SERWERA
// ----------------------
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
