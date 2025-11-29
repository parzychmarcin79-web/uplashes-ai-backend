// UPLashes AI – backend analizy zdjęcia rzęs (raport + mapa)

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // JSON + base64

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

// ===== pomoc: wyciągnięcie tekstu z odpowiedzi OpenAI =====
function extractTextFromOpenAIResponse(data) {
  const messageContent = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  let finalText = "";

  if (Array.isArray(messageContent)) {
    finalText = messageContent
      .map((part) => (part && typeof part.text === "string" ? part.text : ""))
      .join("\n");
  } else if (typeof messageContent === "string") {
    finalText = messageContent;
  }

  return finalText.trim();
}

// ================== /analyze – RAPORT SZEROKI ==================

app.post("/analyze", async (req, res) => {
  try {
    const body = req.body || {};
    const imageBase64 = body.imageBase64;
    const language = body.language;

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

    const userTextPL = `
Przeanalizuj to zdjęcie stylizacji rzęs. 
Najpierw oceń, co jest zrobione dobrze, potem co można poprawić.
Na końcu dodaj krótką rekomendację mapy rzęs (długości w kilku strefach).`;

    const userTextEN = `
Analyse this lash extension photo.
First, describe what is done well, then what could be improved.
At the end, add a short lash map recommendation (lengths in several zones).`;

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
              image_url: {
                url: "data:image/jpeg;base64," + imageBase64,
              },
            },
          ],
        },
      ],
      max_tokens: 800,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("OpenAI /analyze HTTP error:", response.status, errText);
      return res.status(502).json({
        status: "error",
        message: "Błąd komunikacji z modelem AI (OpenAI).",
      });
    }

    const data = await response.json().catch((e) => {
      console.error("JSON parse error /analyze:", e);
      return null;
    });

    const finalText = data ? extractTextFromOpenAIResponse(data) : "";

    if (!finalText) {
      return res.status(500).json({
        status: "error",
        message: "Model AI nie zwrócił poprawnej treści.",
      });
    }

    return res.status(200).json({
      status: "success",
      result: finalText,
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    return res.status(500).json({
      status: "error",
      message: "Wystąpił nieoczekiwany błąd podczas analizy zdjęcia.",
    });
  }
});

// ================== /lash-map – TYLKO MAPKA RZĘS ==================

app.post("/lash-map", async (req, res) => {
  try {
    const body = req.body || {};
    const imageBase64 = body.imageBase64;
    const language = body.language;

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

    const systemPromptPL = `
Jesteś ekspertem od mapowania rzęs (UPLashes AI).
Na podstawie zdjęcia stylizacji rzęs masz wygenerować TYLKO propozycję mapy rzęs.

Wynik ma być:
- podzielony na strefy procentowe oka (0–20%, 20–40%, 40–70%, 70–100%),
- w każdej strefie wymień sugerowane długości (np. 7-8-9, 9-10, 10-11-12),
- możesz wspomnieć o curlu tylko jeśli jest to naprawdę ważne.

Forma:
- krótki, konkretny opis,
- najlepiej w 4–6 linijkach,
- bez emotek, bez wstępu i zakończenia,
- bez opisu jakości pracy – tylko mapa.`;

    const systemPromptEN = `
You are a lash mapping expert (UPLashes AI).
Based on the lash extension photo, generate ONLY a lash map suggestion.

Result must:
- be divided into eye zones (0–20%, 20–40%, 40–70%, 70–100%),
- list recommended lengths in each zone (e.g. 7-8-9, 9-10, 10-11-12),
- mention curl only if really important.

Style:
- short, concrete,
- 4–6 lines,
- no emojis, no intro/outro,
- no quality evaluation, only the map.`;

    const userTextPL = `
Wygeneruj mapę rzęs na podstawie zdjęcia.
Skup się na długościach w poszczególnych strefach oka (0–20%, 20–40%, 40–70%, 70–100%).
Pisz w formie krótkich linijek, nadających się do szybkiego odczytu przez stylistkę.`;

    const userTextEN = `
Generate a lash map based on the photo.
Focus on lengths in each eye zone (0–20%, 20–40%, 40–70%, 70–100%).
Write in short lines that a lash tech can quickly read.`;

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
              image_url: {
                url: "data:image/jpeg;base64," + imageBase64,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("OpenAI /lash-map HTTP error:", response.status, errText);
      return res.status(502).json({
        status: "error",
        message: "Błąd komunikacji z modelem AI (OpenAI) przy mapce.",
      });
    }

    const data = await response.json().catch((e) => {
      console.error("JSON parse error /lash-map:", e);
      return null;
    });

    const finalText = data ? extractTextFromOpenAIResponse(data) : "";

    if (!finalText) {
      return res.status(500).json({
        status: "error",
        message: "Model AI nie zwrócił poprawnej mapki.",
      });
    }

    return res.status(200).json({
      status: "success",
      result: finalText,
    });
  } catch (err) {
    console.error("Błąd w /lash-map:", err);
    return res.status(500).json({
      status: "error",
      message: "Wystąpił nieoczekiwany błąd podczas generowania mapy rzęs.",
    });
  }
});

// ================== START SERWERA ==================

app.listen(PORT, () => {
  console.log("UPLashes AI backend działa na porcie " + PORT);
});
