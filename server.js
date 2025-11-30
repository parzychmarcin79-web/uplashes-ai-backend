// server.js – UPLashes – analiza stylizacji rzęs (prosta analiza zdjęcia)

const express = require("express");
const cors = require("cors");

// W Node 18+ fetch jest globalny. Jeśli kiedyś będzie błąd "fetch is not defined",
// można doinstalować `node-fetch` i odkomentować linijkę poniżej.
// const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // JSON + większe zdjęcia base64

const PORT = process.env.PORT || 10000;

// --- sprawdzenie klucza OpenAI ---
function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");
    return false;
  }
  return true;
}

// --- pomocnicza funkcja: wywołanie OpenAI Chat Completions z obrazem ---
async function callOpenAI(messages, temperature = 0.4) {
  if (!ensureApiKey()) {
    throw new Error("Brak klucza OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Błąd OpenAI:", response.status, errText);
    throw new Error("OpenAI zwróciło błąd");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content.trim();
}

// ------------------------------
//  GET /       – health check
// ------------------------------
app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "uplashes-analyze-only",
    message: "UPLashes – analiza stylizacji rzęs – backend działa.",
  });
});

// ------------------------------
//  GET /status – ping dla frontu
// ------------------------------
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "uplashes-analyze-only",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------
//  POST /analyze – główny endpoint (profesjonalny, nie-szablonowy feedback)
// ------------------------------
app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, language } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Brakuje pola imageBase64 w body żądania.",
      });
    }

    const lang = language === "en" ? "en" : "pl";

    const systemPrompt =
      lang === "en"
        ? `
You are a highly experienced lash trainer writing PREMIUM, personalised feedback for another lash tech.

Rules:
- Analyse THIS PHOTO only – no generic templates.
- Do NOT reuse the same phrases between clients: avoid sentences like "overall the result is nice" or "in general the set looks good".
- Refer to visible details from the image: inner/outer corners, lash line, gaps, direction, stickies, attachment area, coverage, thickness, mapping, symmetry.
- Be concrete, technical and honest, but supportive.

Write the answer in English, in the following structure:

1. Quick overview – 1–2 sentences (global impression of the set, eye shape, overall effect).
2. What is done well – bullet list (2–5 points).
3. What needs improvement – bullet list (3–7 points, very specific: where, what, how to fix).
4. Suggested styling with UPLashes – 1 short paragraph:
   - propose style (e.g. cat eye / open eye / natural)
   - suggested lengths and curls
   - mention UPLashes products in a natural way (lashes, tweezers, prep/primer, glue, bonder).
5. Summary – 1–2 sentences: encourage further practice and precise focus.

Length: about 180–320 words. No generic intros, no copy-paste phrases. Each answer must feel unique to this photo.
`
        : `
Jesteś doświadczoną instruktorką stylizacji rzęs, która pisze PREMIUM, indywidualny feedback dla innej stylistki.

Zasady:
- Analizujesz TYLKO TO KONKRETNE ZDJĘCIE – zero szablonów.
- Nie powtarzaj utartych, ogólnych formułek typu „ogólnie efekt jest ładny”, „zestaw wygląda dobrze”.
- Odnoś się do tego, co REALNIE widać na zdjęciu: kąciki wewnętrzne/zewnętrzne, linia rzęs, prześwity, kierunki, sklejenia, strefa przyklejenia, gęstość, grubość, mapowanie, symetria.
- Bądź konkretna, techniczna i szczera, ale wspierająca – jak dobra trenerka.

Odpowiedź po polsku, w takiej strukturze:

1. Szybka ocena – 1–2 zdania (ogólne wrażenie z aplikacji, kształt oka, efekt).
2. Co jest zrobione dobrze – wypunktowanie (2–5 punktów).
3. Co wymaga poprawy – wypunktowanie (3–7 punktów, bardzo konkretnie: gdzie, co, jak naprawić).
4. Rekomendacja stylizacji z UPLashes – 1 krótki akapit:
   - zaproponuj styl (np. cat eye / open eye / natural),
   - zaproponuj długości i skręty,
   - wpleć naturalnie produkty UPLashes (rzęsy, pęsety, przygotowanie – cleaner/primer, klej, bonder).
5. Podsumowanie – 1–2 zdania z motywacją do dalszej pracy i na co zwrócić uwagę przy kolejnej aplikacji.

Długość: ok. 180–320 słów. Bez generycznych wstępów, bez kopiowania tego samego tekstu między różnymi klientkami. Każda odpowiedź ma brzmieć jak indywidualna analiza konkretnego zdjęcia.
`;

    const userText =
      lang === "en"
        ? "This is a lash extension photo of one eye. Please analyse the work according to the structure and rules above."
        : "To jest zdjęcie aplikacji rzęs na jednym oku. Przeanalizuj pracę według struktury i zasad powyżej.";

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      },
    ];

    // trochę wyższa temperatura = większa różnorodność odpowiedzi
    const text = await callOpenAI(messages, 0.55);

    if (!text) {
      return res.status(500).json({
        status: "error",
        message: "Model nie zwrócił treści analizy.",
      });
    }

    res.status(200).json({
      status: "success",
      result: text,
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    res.status(500).json({
      status: "error",
      message: "Wystąpił nieoczekiwany błąd podczas analizy zdjęcia.",
    });
  }
});


    res.status(200).json({
      status: "success",
      result: text,
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    res.status(500).json({
      status: "error",
      message: "Wystąpił nieoczekiwany błąd podczas analizy zdjęcia.",
    });
  }
});

// ------------------------------
//  START SERWERA
// ------------------------------
app.listen(PORT, () => {
  console.log(`UPLashes – analiza stylizacji rzęs – backend słucha na porcie ${PORT}`);
});
