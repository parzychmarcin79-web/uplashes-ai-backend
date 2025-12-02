// server.js – UPLashes – analiza stylizacji rzęs (bez modułu mapy)

const express = require("express");
const cors = require("cors");

const app = express();
const { analyzeEye } = require("./classify");

// Podstawowe middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // pozwala na duże base64

// PORT z Render / lokalnie domyślnie 10000
const PORT = process.env.PORT || 10000;

// Sprawdzenie klucza OpenAI
function ensureApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");
    return false;
  }
  return true;
}

// Pomocnicza funkcja do wywołania OpenAI Chat Completions
async function callOpenAI(messages, temperature = 0.5) {
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

// ─────────────────────────────────────────────
//  ROUTE 1 – root / (health check Render)
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "analyze-only",
    message: "UPLashes – backend analizy działa poprawnie.",
  });
});

// ─────────────────────────────────────────────
//  ROUTE 2 – /status (ping z frontu)
// ─────────────────────────────────────────────
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "analyze-only",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
//  ROUTE 3 – /analyze – analiza zdjęcia rzęs
// ─────────────────────────────────────────────
app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, language } = req.body;
    const data = await analyzeEye(imageBase64, language);
    return res.json(data);
  } catch (err) {
    console.error("Analyze error:", err);
    return res.status(500).json({
      status: "error",
      message: "Błąd serwera analizy."
    });
  }
});
const lang = language === "en" ? "en" : "pl";

    // System prompt – wersja PL / EN
    const systemPrompt =
      lang === "en"
        ? `
You are an advanced lash styling educator. 
You analyse high-quality photos of eyelash extensions and write a professional report for a lash tech.

ALWAYS respond in English.
Your task is to create a structured, detailed but concise analysis of THIS SPECIFIC PHOTO – do not write generic tips.

Use EXACTLY this structure and headings:

Strong points of the set:
- ...

Things to improve:
- ...

Technical recommendations:
- ...

Quality & safety checks:
- ...

Guidelines:
- Base your comments on what you SEE in the photo: density, direction, mapping, attachment, cleanliness, symmetry, lash health.
- Avoid repeating the same sentences you would use for every client – write as if this is a unique client.
- Use short bullet points (starting with "- ") under each section.
- Total length: roughly 150–220 lines of text, not more than ~2200 characters.
        `.trim()
        : `
Jesteś zaawansowanym edukatorem stylizacji rzęs.
Analizujesz zdjęcia aplikacji rzęs i tworzysz profesjonalny raport dla stylistki.

ZAWSZE odpowiadasz po polsku.
Twoim zadaniem jest przygotować uporządkowaną, konkretną analizę TEGO KONKRETNEGO ZDJĘCIA – unikaj ogólnych porad, pisz o tym, co widzisz.

Użyj DOKŁADNIE takiej struktury i nagłówków:

Mocne strony stylizacji:
- ...

Elementy do poprawy:
- ...

Rekomendacje techniczne:
- ...

Kontrola jakości i bezpieczeństwo:
- ...

Wytyczne:
- Odnoś się do tego, co WIDZISZ na zdjęciu: gęstość, kierunek, mapowanie, łączenie rzęs, czystość pracy, symetria, kondycja rzęs naturalnych.
- Unikaj powtarzania tych samych zdań dla każdej pracy – pisz tak, jakby to była jedna konkretna klientka.
- Używaj krótkich punktów wypunktowanych (zaczynających się od "- ") w każdej sekcji.
- Całość ma być rzeczowa, biznesowa, bez przesadnego „słodzenia”, maks. ok. 2200 znaków.
        `.trim();

    const userText =
      lang === "en"
        ? "Below is the client lash set photo. Analyse it and write the full report in the required structure."
        : "Poniżej masz zdjęcie stylizacji rzęs klientki. Przeanalizuj je i napisz pełny raport w wymaganej strukturze.";

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

    const text = await callOpenAI(messages, 0.5);

    if (!text) {
      return res.status(500).json({
        status: "error",
        message: "AI nie zwróciło treści analizy.",
      });
    }

    res.status(200).json({
      status: "success",
      result: text,
    });
  } catch (error) {
    console.error("Błąd /analyze:", error);
    res.status(500).json({
      status: "error",
      message: "Wystąpił błąd podczas analizy zdjęcia.",
    });
  }
});

// ─────────────────────────────────────────────
//  START SERWERA
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`UPLashes backend analizy działa na porcie ${PORT}`);
});
