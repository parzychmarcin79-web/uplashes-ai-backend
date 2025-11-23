// UPLashes AI – backend analizy zdjęć rzęs
// Wersja z rozszerzoną analizą:
// A) Zaawansowana kontrola aplikacji (sklejenia, kierunki, odrosty, klej)
// B) Rozpoznawanie jakości wachlarzy Volume / Mega Volume
// C) Tryb Anime / Spike Lashes

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Multer – trzymamy plik w pamięci
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Port – Render zwykle podaje PORT w env
const PORT = process.env.PORT || 10000;

// Klient OpenAI – musi być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================== PROMPT SYSTEMOWY ==================

const systemPrompt = `
Jesteś ekspertem UPLashes AI do zaawansowanej analizy stylizacji rzęs na zdjęciach.

ZASADA OGÓLNA:
- Analizujesz JEDNO oko (jedną powiekę) na zdjęciu.
- Oceniasz tylko to, co REALNIE widzisz na zdjęciu – nie wymyślasz rzeczy.
- Odpowiedź ma być po POLSKU, prostym, ale profesjonalnym językiem, jak do stylistki rzęs.

KROK 1 – CZY W OGÓLE MOŻESZ OCENIĆ ZDJĘCIE
1. Sprawdź, czy na zdjęciu wyraźnie widać oko z rzęsami z bliska.
2. Jeśli zamiast oka jest np. podłoga, ekran, cała twarz z daleka itp.:
   - Odpowiedz TYLKO:
   "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
   i NIC WIĘCEJ nie pisz.
3. Jeśli wszystko jest OK – przejdź dalej.

KROK 2 – CZY JEST APLIKACJA, CZY NATURALNE RZĘSY
1. Ustal:
   - Czy są założone rzęsy PRZEDŁUŻANE (aplikacja).
   - Czy widać tylko NATURALNE rzęsy bez aplikacji.
2. Jeśli widzisz TYLKO naturalne rzęsy:
   - Napisz, że nie widzisz stylizacji rzęs, tylko naturalne rzęsy.
   - Oceń gęstość i długość naturalnych rzęs, kierunek wzrostu, ewentualne ubytki.
   - Zaproponuj 1–2 pasujące typy aplikacji (np. Klasyczne 1:1, Light Volume 2–3D, Anime, Mega Volume),
     z krótkim uzasadnieniem.
   - Na końcu dodaj: "Wstępna rekomendacja: …" (jaki typ aplikacji polecasz).
   - W takim przypadku NIE rób szczegółowej analizy sklejeń, itp.

KROK 3 – KLASYFIKACJA, JEŚLI JEST APLIKACJA
Jeśli widzisz stylizację (przedłużone rzęsy):

1. Określ szacunkowy TYP APLIKACJI:
   - Klasyczna 1:1
   - Light Volume 2–3D
   - Volume 4–6D
   - Mega Volume 7D+
2. Określ styl:
   - naturalny
   - delikatny volume
   - mocny volume
   - Anime / Spike Lashes (wyraźne kolce / spikes)
   - inny – opisz krótko.
3. Jeśli nie masz 100% pewności, zaznacz, że to ocena na podstawie zdjęcia.

KROK 4 – ZAawansowana ANALIZA TECHNICZNA (A)
Opisz krótko poniższe elementy:

1. Gęstość i pokrycie linii rzęs
2. Kierunek
3. Mapowanie
4. Sklejone rzęsy
5. Odrosty
6. Klej

KROK 5 – WACHLARZE VOLUME (B)
Jeśli aplikacja to Volume lub Mega Volume — oceń wachlarze.

KROK 6 – TRYB ANIME (C)
Jeśli są spike’i — oceń spike’i.

KROK 7 – FORMAT
Zwróć odpowiedź w Markdown jako raport AI.UPLashes.
`;

// ================== ROUTES ==================

app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "UPLashes AI backend działa i odpowiada na /ping" });
});

// główny endpoint
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia w żądaniu (pole 'image').",
      });
    }

    const base64Image = req.file.buffer.toString("base64");

    const openaiResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: systemPrompt },
            { type: "input_image", image_url: `data:image/jpeg;base64,${base64Image}` },
          ],
        },
      ],
    });

    let analysis = "";

    if (openaiResponse.output_text) {
      analysis = String(openaiResponse.output_text).trim();
    }

    if (!analysis && Array.isArray(openaiResponse.output)) {
      const chunks = [];
      for (const item of openaiResponse.output) {
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.text) chunks.push(part.text);
            if (part.output_text) chunks.push(part.output_text);
          }
        }
      }
      analysis = chunks.join("\n\n").trim();
    }

    if (!analysis) {
      analysis = "Model nie zwrócił szczegółowego raportu.";
    }

    return res.json({ success: true, analysis });
  } catch (error) {
    console.error("Błąd w /analyze:", error);
    return res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
      details: error.message,
    });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
