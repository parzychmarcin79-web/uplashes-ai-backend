// UPLashes AI – backend testowy + moduły OpenAI
// Wersja z działającym statusem "live" i prostą mapą rzęs + analizą zdjęć

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// --------------------------------------------
// ROUTE 1 – root / health check
// --------------------------------------------
app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "lash-map-test",
    message: "UPLashes AI – testowy backend mapy rzęs działa.",
  });
});

// --------------------------------------------
// ROUTE 2 – status
// --------------------------------------------
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "lash-map-test",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------
// ROUTE 3 – testowa mapa rzęs (statyczna)
// --------------------------------------------
app.post("/lash-map", (req, res) => {
  const { eyeType, style, curl, thickness, note, customSections } = req.body || {};

  const exampleMap = {
    status: "success",
    module: "lash-map-test",
    baseConfig: {
      eyeType: eyeType || "standard",
      style: style || "natural-open-eye",
      curl: curl || "C",
      thickness: thickness || "0.10",
      note: note || "Przykładowa mapa z backendu testowego.",
    },
    sections: [
      {
        id: "inner",
        label: "Kącik wewnętrzny",
        fromPercent: 0,
        toPercent: 20,
        lengths: [7, 8, 9],
        comment: "Delikatny początek, krótsze długości.",
      },
      {
        id: "transition",
        label: "Strefa przejściowa",
        fromPercent: 20,
        toPercent: 40,
        lengths: [9, 10],
        comment: "Łagodne budowanie efektu.",
      },
      {
        id: "center",
        label: "Strefa centralna",
        fromPercent: 40,
        toPercent: 70,
        lengths: [10, 11, 12],
        comment: "Największe otwarcie oka.",
      },
      {
        id: "outer",
        label: "Kącik zewnętrzny",
        fromPercent: 70,
        toPercent: 100,
        lengths: [11, 10],
        comment: "Delikatne wyciągnięcie zewnętrzne.",
      },
    ],
    customSections: customSections || null,
    generatedAt: new Date().toISOString(),
  };

  return res.status(200).json(exampleMap);
});

// ===================================================
// POMOCNICZA FUNKCJA – wywołanie OpenAI z obrazem
// ===================================================
async function analyzeImageWithPrompt(imageBase64, systemPrompt) {
  if (!OPENAI_API_KEY) {
    throw new Error("Brak OPENAI_API_KEY w zmiennych środowiskowych.");
  }

  // Node 18+ ma globalny fetch – nie potrzebujemy dodatkowych bibliotek
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "To jest zdjęcie rzęs klientki. Przeanalizuj je zgodnie z instrukcją z systemPrompt.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      "Błąd odpowiedzi OpenAI: " +
        response.status +
        " " +
        response.statusText +
        " " +
        errorText
    );
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message?.content || "";
  return message;
}

// --------------------------------------------
// ROUTE 4 – podstawowa analiza zdjęcia rzęs
// POST /analyze-basic
// body: { imageBase64: "...." }
// --------------------------------------------
app.post("/analyze-basic", async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        status: "error",
        message: "Brak pola imageBase64 w zapytaniu.",
      });
    }

    const systemPrompt = `
Jesteś doświadczoną instruktorką stylizacji rzęs.
Analizujesz zdjęcie rzęs klientki.
Opisz:
- gęstość rzęs (rzadkie, średnie, gęste),
- kierunek (równe, rozchodzące się, krzyżujące),
- jakość aplikacji (czy są przyklejone poprawnie, czy widać sklejki),
- kondycję naturalnych rzęs,
- ewentualne prześwity,
- krótkie rekomendacje co poprawić przy następnej aplikacji.
Odpowiedz zwięźle, maksymalnie kilka akapitów.
    `;

    const resultText = await analyzeImageWithPrompt(imageBase64, systemPrompt);

    return res.status(200).json({
      status: "success",
      module: "analyze-basic",
      result: resultText,
    });
  } catch (err) {
    console.error("Błąd w /analyze-basic:", err);
    return res.status(500).json({
      status: "error",
      module: "analyze-basic",
      message: "Błąd serwera przy analizie zdjęcia.",
      details: err.message || String(err),
    });
  }
});

// --------------------------------------------
// ROUTE 5 – zaawansowana analiza (techniczna)
// POST /analyze-advanced
// body: { imageBase64: "...." }
// --------------------------------------------
app.post("/analyze-advanced", async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        status: "error",
        message: "Brak pola imageBase64 w zapytaniu.",
      });
    }

    const systemPrompt = `
Jesteś ekspertem od stylizacji rzęs i instruktorem.
Analizujesz aplikację rzęs na zdjęciu bardzo technicznie.
Podziel odpowiedź na sekcje:
1) Ogólna jakość aplikacji
2) Błędy techniczne (np. sklejki, zła odległość od powieki, nierówny kierunek)
3) Długości i skręty – czy są dobrze dobrane do oka
4) Bezpieczeństwo naturalnych rzęs (czy są przeciążone, czy widać uszkodzenia)
5) Rekomendacje krok po kroku, co poprawić przy kolejnej wizycie.

Pisz konkretnie, bez lania wody.
    `;

    const resultText = await analyzeImageWithPrompt(imageBase64, systemPrompt);

    return res.status(200).json({
      status: "success",
      module: "analyze-advanced",
      result: resultText,
    });
  } catch (err) {
    console.error("Błąd w /analyze-advanced:", err);
    return res.status(500).json({
      status: "error",
      module: "analyze-advanced",
      message: "Błąd serwera przy zaawansowanej analizie zdjęcia.",
      details: err.message || String(err),
    });
  }
});

// --------------------------------------------
// START SERWERA
// --------------------------------------------
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
