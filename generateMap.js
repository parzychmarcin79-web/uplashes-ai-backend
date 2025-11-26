
// generateMap.js
// Osobny moduł do generowania mapki rzęs na podstawie zdjęcia

const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");

const router = express.Router();

// Multer – trzymamy plik w pamięci (osobna instancja, niezależna od server.js)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Klient OpenAI tylko dla tego modułu
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Pomocnicza funkcja – wyciąganie tekstu z odpowiedzi OpenAI
function extractTextFromResponse(openaiResponse) {
  try {
    if (typeof openaiResponse.output_text === "string") {
      const t = openaiResponse.output_text.trim();
      if (t) return t;
    }

    let chunks = [];

    if (Array.isArray(openaiResponse.output)) {
      for (const item of openaiResponse.output) {
        if (!item || !Array.isArray(item.content)) continue;

        for (const part of item.content) {
          if (!part) continue;

          if (Array.isArray(part.text)) {
            for (const t of part.text) {
              if (t && typeof t.text === "string") {
                chunks.push(t.text);
              }
            }
          } else if (typeof part.text === "string") {
            chunks.push(part.text);
          } else if (typeof part.output_text === "string") {
            chunks.push(part.output_text);
          }
        }
      }
    }

    const joined = chunks.join("\n\n").trim();
    if (joined) return joined;
  } catch (e) {
    console.error("Błąd przy parsowaniu odpowiedzi OpenAI (mapka):", e);
  }

  return "";
}

// Główny endpoint do generowania MAPKI RZĘS
router.post("/generate-map", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Brak zdjęcia w żądaniu (pole 'image').",
      });
    }

    const language = (req.body.language || "pl").toLowerCase();
    const base64Image = req.file.buffer.toString("base64");

    // PROMPT – TYLKO PO POLSKU, z użyciem produktów UPLashes
    const prompt = `
Jesteś ekspertem UPLashes i tworzysz PROPOZYCJĘ MAPY RZĘS na podstawie zdjęcia oka.

ZASADY:
- Odpowiadasz TYLKO po polsku.
- Nie opisujesz już jakości aplikacji – tylko propozycję mapy rzęs.
- Mapę dopasowujesz do kształtu oka widocznego na zdjęciu.
- W opisie używaj przykładów bazujących na produktach UPLashes:
  • Grubości: 0.05, 0.06, 0.07
  • Skręty: C, CC, D, L, M (jeśli pasują do oka – nie musisz używać wszystkich)
  • Długości: od 6 mm do 14 mm
- Jeśli oko wygląda na bardzo wrażliwe / słabe naturalne rzęsy – sugeruj delikatniejsze rozwiązania.

FORMAT ODPOWIEDZI:
Zwróć zwięzły, ale konkretny opis w punktach:

1. Ogólna koncepcja efektu:
   - np. "Delikatny volume z lekkim uniesieniem zewnętrznych kącików"
   - albo "Mocny, zagęszczający efekt na całej linii"

2. Propozycja mapy rzęs (strefy + długości):
   - Wewnętrzny kącik: ... mm
   - Strefa 1/3 wewnętrzna: ... mm
   - Strefa środkowa: ... mm
   - Strefa 1/3 zewnętrzna: ... mm
   - Zewnętrzny kącik: ... mm

3. Skręt i grubość:
   - Skręt główny: ...
   - Czy warto mieszać skręty? (np. C + CC, CC + D)
   - Grubość: ... (np. 0.06 Mega Volume UPLashes)

4. Zalecany typ aplikacji:
   - Klasyczna 1:1 / Light Volume 2–3D / Volume 4–6D / Mega Volume 7D+ / Anime itp.
   - Krótko wyjaśnij: dlaczego ten typ pasuje do tego oka.

5. Krótkie wskazówki techniczne:
   - max 3 krótkie punkty, np. o gęstości, wysokości przyklejenia, pracy w kącikach.

Nie pisz nagłówków typu "###" – po prostu punkty jak w profesjonalnej notatce dla stylistki.
`;

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    console.log(
      "Odpowiedź z OpenAI (MAPKA RZĘS):",
      JSON.stringify(openaiResponse, null, 2)
    );

    let mapText = extractTextFromResponse(openaiResponse);

    if (!mapText) {
      mapText =
        "Model nie zwrócił szczegółowej propozycji mapy rzęs. Spróbuj ponownie z wyraźniejszym zdjęciem jednego oka.";
    }

    return res.json({ map: mapText });
  } catch (error) {
    console.error("Błąd w /generate-map:", error);
    return res.status(500).json({
      error: "Błąd serwera podczas generowania mapy rzęs.",
      details: error.message || String(error),
    });
  }
});

// Eksportujemy router, żeby podpiąć go w server.js
module.exports = router;
