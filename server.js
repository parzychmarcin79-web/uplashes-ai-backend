// server.js – UPLashes AI backend (wersja docelowa)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – plik w pamięci, max 8 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Klient OpenAI – na Render MUSI być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔹 Prosty healthcheck – żebyś mogła sprawdzić, czy backend żyje
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// 🔹 Główna trasa analizy
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    // 1) Czy na pewno przyszło zdjęcie?
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Brak pliku obrazu. Prześlij zdjęcie oka z rzęsami.",
      });
    }

    // 2) Zamiana na data URL dla modelu
    const base64 = req.file.buffer.toString("base64");
    const imageDataUrl = `data:${req.file.mimetype};base64,${base64}`;

    // 3) Prompt – logika A / B / C
    const prompt = `Jesteś ekspertem od stylizacji rzęs i piszesz raporty dla aplikacji UPLashes AI.

Twoje zadanie:

1. Najpierw w myślach zaklasyfikuj obraz do jednej z trzech kategorii:
   - A) "extensions" – widzę oko z zaaplikowanymi rzęsami (przedłużanie, kępki, volume).
   - B) "natural" – widzę oko, ale rzęsy wyglądają na naturalne, bez stylizacji.
   - C) "invalid" – nie widzę wyraźnego zbliżenia jednego oka z rzęsami (np. zdjęcie z daleka, inny obiekt, zbyt ciemne / rozmazane).

2. Na podstawie tej klasyfikacji ZWRÓĆ TYLKO gotowy raport w **markdown po polsku**, BEZ JSON, BEZ wypisywania liter A/B/C.

=== DLA A) extensions ===
Napisz raport pod nagłówkiem:

### AI.UPLashes Report

Następnie w punktach:

1. **Gęstość i pokrycie** – oceń gęstość aplikacji, czy widać luki, dziury, zbyt puste lub zbyt ciężkie miejsca.
2. **Kierunek i górna linia** – czy rzęsy układają się w podobnym kierunku, czy górna linia jest równa i estetyczna, czy coś „wyskakuje” z linii.
3. **Mapowanie i styl** – do jakiego efektu jest najbliżej (np. 1:1, 2–3D, 4–6D, mega volume, doll eye, fox eye, kim, wet look itd.), jak rozłożone są długości.
4. **Jakość przyklejenia** – czy widać sklejki, odstające rzęsy, krzyżujące się podstawy, czy linia przyklejenia jest czysta.
5. **Bezpieczeństwo i komfort** – czy widać zaczerwienienie, podrażnienia, zbyt ciężkie kępki, niebezpieczne odklejenia.

Na końcu dodaj sekcję:

### Wskazówki do poprawy

i wypisz konkretne, praktyczne tipy dla stylistki (co może zrobić lepiej przy kolejnej aplikacji).

=== DLA B) natural ===
Także użyj nagłówka:

### AI.UPLashes Report

Wyjaśnij jasno, że na zdjęciu NIE WIDZISZ stylizacji rzęs – tylko naturalne rzęsy, dlatego nie możesz ocenić wykonanej aplikacji.
Następnie zaproponuj 2–3 warianty stylizacji, które mogłyby pasować do tego oka, np.:

- delikatne 1:1 dla bardzo naturalnego efektu,
- 2–3D dla subtelnej objętości,
- 4–6D lub mega volume dla mocnego efektu, jeśli klientka lubi dramatyczny look.

Daj krótkie uzasadnienie, do kogo / jakiego typu klientki każda propozycja pasuje.

=== DLA C) invalid ===
Użyj nagłówka:

### AI.UPLashes Report

i napisz krótki komunikat w stylu:
"Nie widzę na zdjęciu wyraźnego oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska, ostre, dobrze doświetlone, bez filtra."

BARDZO WAŻNE:
- Nigdy nie udawaj, że widzisz stylizację, jeśli jej nie ma.
- Jeśli nie masz pewności, zachowuj się jak kategoria C.
- Nie wypisuj kategorii A/B/C – tylko gotowy raport w markdown.
- Pisz wyłącznie po polsku.`;

    // 4) Wywołanie modelu z obrazem
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl },
          ],
        },
      ],
    });

    const text =
      response.output?.[0]?.content?.[0]?.text?.trim() ||
      "Nie udało się wygenerować raportu dla tego zdjęcia.";

    // 5) Sukces – frontend oczekuje statusu 200
    return res.json({
      ok: true,
      reportMarkdown: text,
    });
  } catch (error) {
    console.error("Błąd w /analyze:", error);

    return res.status(500).json({
      ok: false,
      error: "Błąd po stronie serwera podczas analizy obrazu.",
    });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`UPLashes AI backend listening on port ${PORT}`);
});
