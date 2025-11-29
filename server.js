// UPLashes AI – backend analizy zdjęcia rzęs (moduł ANALYZE)

// Prosty backend na Express + CORS
const express = require("express");
const cors = require("cors");

const app = express();

// Ustawienia podstawowe
app.use(cors());
app.use(express.json({ limit: "10mb" })); // JSON + base64 zdjęcia

// PORT – Render sam ustawia w zmiennej środowiskowej
const PORT = process.env.PORT || 10000;

// Klucz do OpenAI – MUSI być ustawiony w Render → Environment → OPENAI_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ================== ROUTES PODSTAWOWE ==================

// Root – prosty tekst / JSON, żeby sprawdzić czy backend żyje
app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "analyze",
    message: "UPLashes AI – backend analizy rzęs działa.",
  });
});

// /status – używane przez frontend do sprawdzania połączenia
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "analyze",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ================== GŁÓWNA TRASA: /analyze ==================
/**
 * POST /analyze
 * body: { imageBase64: string, language: "pl" | "en" }
 * zwraca: { status: "success", result: "tekst raportu..." } lub { status: "error", message: "..." }
 */

app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, language } = req.body || {};

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        status: "error",
        message: "Brak klucza OPENAI_API_KEY na backendzie.",
      });
    }

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Brak zdjęcia w polu imageBase64.",
      });
    }

    const lang = language === "en" ? "en" : "pl";

    // PROMPT – wersja PL / EN
    const systemPromptPL = `
Jesteś asystentem UPLashes AI. Analizujesz zdjęcie stylizacji rzęs.
Na podstawie zdjęcia:
- oceń gęstość naturalnych rzęs,
- oceń jakość aplikacji (kierunek, równomierność, czystość pracy),
- wspomnij o mapowaniu (czy długości są dobrane harmonijnie),
- zaproponuj, co można poprawić przy kolejnej aplikacji.

Pisz zwięźle, konkretnie, w maksymalnie 8–10 punktach.
Bez emotek, bez zwrotów typu „Droga klientko”.
Tekst ma być zrozumiały dla stylistki rzęs.`;

    const systemPromptEN = `
You are UPLashes AI assistant. You analyse an eyelash extension photo.
Based on the image:
- evaluate natural lash density,
- evaluate application quality (direction, symmetry, cleanliness),
- comment on mapping (lengths and styling),
- suggest what could be improved next time.

Write concisely, in 8–10 bullet points.
No emojis, no greetings.
Target audience: professional lash tech.`;

    const systemPrompt = lang === "en" ? systemPromptEN : systemPromptPL;

    const userTextPL = `
Przeanalizuj to zdjęcie stylizacji rzęs. 
Najpierw oceń, co jest zrobione dobrze, potem co można poprawić.
Na końcu dodaj krótką rekomendację mapy rzęs (długości w kilku strefach).`;

    const userTextEN = `
Analyse this lash extension photo.
First, describe what is done well, then what could be improved.
At the end, add a short lash map recommendation (lengths in several zones).`;

    const userText = lang === "en" ? userTextEN : userTextPL;

    // Przygotowanie wiadomości do OpenAI – model GPT-4o-mini z obrazem
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userText,
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
      max_tokens: 800,
    };

    // Wywołanie OpenAI Chat Completions
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
      return res.status(502).json({
        status: "error",
        message: "Błąd komunikacji z modelem AI (OpenAI).",
      });
    }

    const data = await response.json();

    const messageContent = data?.choices?.[0]?.message?.content;
    let finalText = "";

    if (Array.isArray(messageContent)) {
      finalText = messageContent
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("\n");
    } else if (typeof messageContent === "string") {
      finalText = messageContent;
    } else {
      finalText = "";
    }

    if (!finalText.trim()) {
      return res.status(500).json({
        status: "error",
        message: "Model AI nie zwrócił poprawnej treści.",
      });
    }

    return res.status(200).json({
      status: "success",
      result: finalText.trim(),
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    return res.status(500).json({
      status: "error",
      message: "Wystąpił nieoczekiwany błąd podczas analizy zdjęcia.",
    });
  }
});

// ================== START SERWERA ==================
app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
