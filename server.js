// UPLashes AI – backend analizy zdjęć rzęs
// Plik: server.js (wersja CJS – const require)

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
const upload = multer({ storage: multer.memoryStorage() });

// Klient OpenAI – na Render musi być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prosty test, żeby nie było "Cannot GET /"
app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

/**
 * GŁÓWNY ENDPOINT:
 *  POST /analyze
 *  - plik: field "image" (form-data)
 *  - body.language: "pl" lub "en"
 *  - body.analysisType: "before" lub "after"
 */
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nie przesłano pliku." });
    }

    const { language = "pl", analysisType = "after" } = req.body;

    const mimeType = req.file.mimetype || "image/jpeg";
    const base64Image = req.file.buffer.toString("base64");
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    const langLabel = language === "en" ? "English" : "Polski";

    const systemPrompt = `
Jesteś doświadczoną instruktorką stylizacji rzęs.
Analizujesz zdjęcia oka i stylizacji rzęs.
Odpowiadasz ZAWSZE w języku: ${langLabel}.
`;

    const userPrompt = `
Mamy zdjęcie oka klientki (może być przed albo po stylizacji).

1) Najpierw sprawdź, czy NA PEWNO widać oko z rzęsami.
   Jeśli zdjęcie NIE przedstawia oka z rzęsami (np. podłoga, ściana, tekst, losowy obiekt):
   Odpowiedz TYLKO jednym krótkim zdaniem:

   - po polsku:
     "Na zdjęciu nie widać oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
   - po angielsku:
     "I can't see an eye with lashes to analyze. Please upload a close-up photo of one eye."

   I NIC więcej – zero analizy, zero punktów.

2) Jeśli zdjęcie jest prawidłowe – zrób pełną analizę jako profesjonalny feedback dla stylistki.

   Jeśli analysisType = "before":
   - potraktuj zdjęcie jako PRZED aplikacją
   - oceń:
       • długość, gęstość i kierunek naturalnych rzęs,
       • kształt oka i powieki,
       • kondycję rzęs (mocne/słabe, przerzedzone, zniszczone),
     a potem podaj:
       • rekomendowany efekt (natural, doll eye, fox, itp.),
       • proponowane długości, skręty, grubości,
       • ostrzeżenia, jeśli rzęsy są zbyt słabe lub bardzo krótkie,
       • praktyczne wskazówki przed aplikacją.

   Jeśli analysisType = "after":
   - oceń wykonaną stylizację:
       • gęstość i równomierność,
       • kierunek i symetrię,
       • odstęp od powieki i czystość pracy (brak sklejek),
       • jakość kępek (przy wolumie),
       • dopasowanie efektu do anatomii oka.
     Następnie podaj:
       • największe plusy,
       • najważniejsze błędy,
       • konkretne wskazówki, co poprawić przy kolejnej aplikacji.

3) Styl:
   - krótko, konkretnie, w punktach,
   - bez obrażania, ale szczerze i zawodowo,
   - maksymalnie 10–14 zdań.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      temperature: 0.4,
    });

    const msg = completion.choices?.[0]?.message;
    let analysis = "";

    if (Array.isArray(msg?.content)) {
      analysis = msg.content.map((part) => part.text || "").join("\n\n");
    } else if (typeof msg?.content === "string") {
      analysis = msg.content;
    } else {
      analysis = "Brak treści analizy z modelu.";
    }

    // Zwracamy w formacie zgodnym ze starym frontendem
    return res.json({
      success: true,
      analysis,
      result: analysis,
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    return res.status(500).json({
      success: false,
      error: "Wystąpił błąd po stronie serwera podczas analizy zdjęcia.",
    });
  }
});

// Fallback na inne ścieżki
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint nie istnieje." });
});

// Start serwera
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
