// UPLashes AI – backend analizy zdjęcia rzęs (moduł ANALYZE + LASH-MAP)

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // JSON + base64 zdjęcia

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ================== ROUTES PODSTAWOWE ==================

app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "analyze + lash-map",
    message: "UPLashes AI – backend działa.",
  });
});

app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "analyze + lash-map",
    version: "1.1.0",
    timestamp: new Date().toISOString(),
  });
});

// ================== POMOCNICZA FUNKCJA DO OPENAI ==================

async function callOpenAIWithImage({ imageBase64, language, systemPromptPL, systemPromptEN, userTextPL, userTextEN, maxTokens = 800 }) {
  if (!OPENAI_API_KEY) {
    return {
      errorStatus: 500,
      errorMessage: "Brak klucza OPENAI_API_KEY na backendzie.",
    };
  }

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return {
      errorStatus: 400,
      errorMessage: "Brak zdjęcia w polu imageBase64.",
    };
  }

  const lang = language === "en" ? "en" : "pl";
  const systemPrompt = lang === "en" ? systemPromptEN : systemPromptPL;
  const userText = lang === "en" ? userTextEN : userTextPL;

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      },
    ],
    max_tokens: maxTokens,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("OpenAI HTTP error:", response.status, errText);
    return {
      errorStatus: 502,
      errorMessage: "Błąd komunikacji z modelem AI (OpenAI).",
    };
  }

  const data = await response.json().catch((e) => {
    console.error("JSON parse error:", e);
    return null;
  });

  const messageContent = data?.choices?.[0]?.message?.content;
  let finalText = "";

  if (Array.isArray(messageContent)) {
    finalText = messageContent
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n");
  } else if (typeof messageContent === "string") {
    finalText = messageContent;
  }

  if (!finalText.trim()) {
    return {
      errorStatus: 500,
      errorMessage: "Model AI nie zwrócił poprawnej treści.",
    };
  }

  return { result: finalText.trim() };
}

// ================== /analyze – RAPORT SZEROKI ==================

app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, language } = req.body || {};

    const systemPromptPL = `
Jesteś asystentem UPLashes AI. Analizujesz zdjęcie stylizacji rzęs.
Na podstawie zdjęcia:
- oceń gęstość naturalnych rzęs,
- oceń jakość aplikacji (kierunek, równomierność, czystość pracy),
- wspomnij o mapowaniu (czy długości są dobrane harmonijnie),
- zaproponuj, co można poprawić przy kolejnej aplikacji.

Pisz zwięźle, konkretni
