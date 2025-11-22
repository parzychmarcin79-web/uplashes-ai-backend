// UPLashes AI – backend analizy zdjęć rzęs (pełna wersja z A/B/C)

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 10000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak zdjęcia." });
    }

    const base64Image = req.file.buffer.toString("base64");

    // =============================
    //  GŁÓWNY PROMPT SYSTEMOWY
    // =============================

    const prompt = `
Jesteś ekspertem UPLashes AI do zaawansowanej analizy stylizacji rzęs na zdjęciach.

ZASADA OGÓLNA:
- Analizujesz JEDNO oko (jedną powiekę).
- Oceniasz tylko to, co realnie widać.
- Piszesz po POLSKU, profesjonalnie, ale zrozumiale dla stylistki rzęs.

====================
KROK 1 – Czy na zdjęciu jest stylizacja?
====================
1) Jeśli zdjęcie nie przedstawia oka z bliska:
   -> Odpowiedz TYLKO:
      "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
   I NIC WIĘCEJ.

2) Jeśli są NATURALNE rzęsy (bez aplikacji):
   - Napisz, że widzisz naturalne rzęsy.
   - Zaproponuj 1–2 typy aplikacji (1:1, 2–3D, Anime, Volume itd.)
   - Daj krótkie uzasadnienie.

====================
KROK 2 – Typ aplikacji (jeśli jest stylizacja)
====================
Określ:
- Klasyczna 1:1
- Light Volume 2–3D
- Volume 4–6D
- Mega Volume 7D+
DODATKOWO:
- Czy obecny jest efekt Anime / Spike? (kolce/spikes)

====================
KROK 3 – Analiza techniczna (A)
====================
Oceń:
1. Gęstość i pokrycie linii rzęs
2. Kierunek i ustawienie rzęs
3. Mapowanie / długości
4. Sklejone rzęsy – opisz jeśli widać
5. Odrosty – czy są duże?
6. Klej – czy jest czysto, czy są grudki?

====================
KROK 4 – Mega Volume (B – jeśli dotyczy)
====================
Jeśli aplikacja jest Volume/Mega:
- Jakość wachlarzy (symetria / rozłożenie / ciężkość)
- Czy bazy są czyste
- Czy wachlarze są regularne
Jeśli NIE:
- Napisz: "B) Mega Volume: nie dotyczy tej aplikacji."

====================
KROK 5 – Anime / Spike (C – jeśli dotyczy)
====================
Jeśli stylizacja ma kolce/spikes:
- Oceń rozmieszczenie kolców
- Jakość spajków
- Wypełnienie między nimi
Jeśli NIE:
- Napisz: "C) Anime / Spike Lashes: nie dotyczy tego zdjęcia."

====================
KROK 6 – Format odpowiedzi
====================
Zwróć finalny raport w Markdown:

### AI.UPLashes REPORT
1. Czy widzę stylizację?
2. Typ stylizacji
3. Analiza techniczna A
4. Jakość wachlarzy (jeśli dotyczy)
5. Anime / Spike (jeśli dotyczy)
6. Najważniejsze wskazówki (3–5 punktów)

Na końcu:
"Wstępna klasyfikacja: …"
"Rekomendacja kolejnego kroku dla stylistki: …"
`;

    // =============================
    //  ZAPYTANIE DO OPENAI
    // =============================

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

    // =============================
    //  WYCIĄGANIE TEKSTU
    // =============================

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

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Błąd w /analyze:", error);
    res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
