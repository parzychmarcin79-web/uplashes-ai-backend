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
//  POST /analyze – główny endpoint
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
        ? "You are a professional lash stylist. You analyse lash extension work on photos and give clear, practical feedback for another lash tech. Focus on: density, direction, mapping, natural lash health, attachment/isolation quality and 3–5 key tips to improve the result. Be specific but concise."
        : "Jesteś profesjonalną stylistką rzęs. Analizujesz aplikację rzęs na zdjęciu i przekazujesz jasny, praktyczny feedback dla innej stylistki. Skup się na: gęstości, kierunku, mapowaniu, kondycji rzęs naturalnych, jakości przyklejenia/izolacji oraz 3–5 kluczowych wskazówkach jak poprawić efekt. Pisz konkretnie, ale zwięźle.";

    const userText =
      lang === "en"
        ? "Here is a lash extension photo of one eye. Please analyse the work and give professional feedback."
        : "To jest zdjęcie aplikacji rzęs na jednym oku. Przeanalizuj pracę i podaj profesjonalny feedback.";

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

    const text = await callOpenAI(messages, 0.45);

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

// ------------------------------
//  START SERWERA
// ------------------------------
app.listen(PORT, () => {
  console.log(`UPLashes – analiza stylizacji rzęs – backend słucha na porcie ${PORT}`);
});
