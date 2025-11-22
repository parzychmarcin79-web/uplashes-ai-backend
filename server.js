// UPLashes AI – backend analizy zdjęć rzęs (endpoint /analyze)
// Plik: server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Klient OpenAI – pamiętaj o ustawieniu zmiennej OPENAI_API_KEY w Render
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Konfiguracja multer – plik w pamięci, max 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Endpoint testowy
app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

// Główny endpoint analizy zdjęcia rzęs
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak pliku ze zdjęciem." });
    }

    const mimeType = req.file.mimetype || "image/jpeg";
    const base64 = req.file.buffer.toString("base64");
    const imageUrl = `data:${mimeType};base64,${base64}`;

    // opcjonalna etykieta z frontu (before / after)
    const labelFromClient = req.body.beforeAfter || "";

    const prompt = `
Na zdjęciu mogą znajdować się rzęsy klientki (przed lub po stylizacji).

Twoje zadanie:

1. Najpierw oceń, czy na zdjęciu na pewno widać oko i rzęsy (naturalne lub przedłużane).
2. Jeśli NIE widać rzęs (np. podłoga, ściana, twarz bez oka, coś zupełnie innego) – odpowiedz TYLKO:
"Na zdjęciu nie widać rzęs do analizy."
i NIC więcej nie dodawaj.

3. Jeśli widać rzęsy – wykonaj profesjonalną analizę po POLSKU, skierowaną do stylistki rzęs, maksymalnie w 8–12 zdaniach.

Uwzględnij:
- gęstość i ilość rzęs,
- kierunek, kierunkowanie i symetrię,
- czystość pracy (sklejki, odstępy od powieki, linia przyklejenia),
- dobór długości, grubości i skrętu,
- ogólne wrażenie estetyczne pracy.

4. Spróbuj określić, czy to raczej zdjęcie "before" czy "after" stylizacji.
   - Jeśli wygląda jak gotowa stylizacja – traktuj jako "after".
   - Jeśli rzęsy są naturalne / bez aplikacji – traktuj jako "before".

Na końcu odpowiedzi dopisz osobną linię:
"Typ zdjęcia: before"
lub
"Typ zdjęcia: after"

Jeśli z frontendu dostałaś etykietę "${labelFromClient}", możesz ją użyć jako dodatkową wskazówkę, ale ostatecznie zdecyduj sama na podstawie obrazu.

Pisz konkretnie, profesjonalnie, po polsku.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      temperature: 0.6,
    });

    const content = completion?.choices?.[0]?.message?.content;
    let text = "";

    if (Array.isArray(content)) {
      text = content.map((part) => part.text || "").join("\n\n");
    } else if (typeof content === "string") {
      text = content;
    }

    return res.json({
      success: true,
      analysis: text,
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    return res.status(500).json({
      success: false,
