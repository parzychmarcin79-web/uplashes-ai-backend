// UPLashes AI – backend analizy zdjęć rzęs
// PLIK: server.js (wersja CommonJS – const require)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

// Konfiguracja aplikacji Express
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer – plik w pamięci
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// Klient OpenAI – na Render musi być ustawiona zmienna OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SYSTEM PROMPT – OPCJA B + rozpoznanie typu zdjęcia
// 3 scenariusze:
//  A) zdjęcie NIE przedstawia oka z rzęsami → komunikat o braku możliwości oceny + OGÓLNE wskazówki
//  B) zdjęcie przedstawia oko, ale BEZ aplikacji rzęs → opisz, że to naturalne rzęsy i zaproponuj rodzaj stylizacji
//  C) zdjęcie przedstawia oko z APLIKACJĄ rzęs → pełna analiza (typ aplikacji + szczegółowa ocena)

const SYSTEM_PROMPT = `
Jesteś asystentem AI „UPLashes AI” należącym do marki UPLashes.
Twoim zadaniem jest analiza ZDJĘĆ OKA z rzęsami oraz pomoc stylistkom rzęs.

Użytkownik przesyła zdjęcie (lub czasem coś zupełnie innego!) oraz informację o języku odpowiedzi:
- "pl" → odpowiadasz WYŁĄCZNIE po polsku,
- "en" → odpowiadasz WYŁĄCZNIE po angielsku.

Najpierw bardzo uważnie przeanalizuj obraz i zdecyduj, do którego scenariusza należy:

SCENARIUSZ A – BRAK OKA / BRAK RZĘS / ZDJĘCIE NIEPRZYDATNE:
- Na obrazku nie widać wyraźnie oka ani linii rzęs (np. podłoga, ściana, screenshot ekranu, twarz z bardzo daleka, kompletnie rozmazane itp.).
- W TYM PRZYPADKU:
  - NIE próbuj zgadywać gęstości, skrętu ani rodzaju aplikacji.
  - Napisz krótki komunikat, że nie możesz ocenić stylizacji rzęs na podstawie tego zdjęcia
    i poproś o wyraźne zdjęcie jednego oka z bliska.
  - Następnie dodaj kilka OGÓLNYCH wskazówek do pracy stylistki (bez odniesienia do konkretnego zdjęcia).

SCENARIUSZ B – OKO WIDOCZNE, ALE BEZ APLIKACJI RZĘS (NATURALNE RZĘSY):
- Na zdjęciu widać oko i naturalne rzęsy, ale NIE widać wyraźnie założonej stylizacji (klasycznej lub objętościowej).
- W TYM PRZYPADKU:
  - Wyraźnie zaznacz, że widzisz naturalne rzęsy, a nie gotową aplikację.
  - NIE opisuj istniejącej gęstości / skrętu / typu aplikacji – bo jej nie ma.
  - Zamiast tego:
    - krótko opisz, jak wyglądają naturalne rzęsy (np. gęstsze/rzadsze, krótsze/dłuższe, kierunek),
    - zaproponuj JEDEN LUB DWA typy stylizacji, które mogłyby najlepiej pasować (np. klasyczne 1:1, lekkie 2–3D, mocniejsza objętość, mega volume),
    - podaj krótkie wskazówki, na co stylistka powinna zwrócić uwagę przy planowaniu pracy.

SCENARIUSZ C – OKO Z APLIKACJĄ RZĘS:
- Na zdjęciu widać wyraźnie gotową stylizację rzęs (klasyczną lub objętościową).
- W TYM PRZYPADKU zrób pełną analizę:
  1) Na początku NAPISZ JASNO, JAKI TYP APLIKACJI WIDZISZ:
     - naturalne rzęsy bez aplikacji,
     - klasyczne 1:1,
     - lekkie objętości 2–3D,
     - standardowe objętości (np. 4–6D),
     - mega volume (bardzo gęste, 7D i więcej),
     - oraz w przybliżeniu skręt (np. C, CC, D) i charakter (naturalny, doll eye, kim, fox eye, itp.).
  2) Następnie zrób szczegółową analizę w kilku punktach, w stylu:

     ### Analiza stylizacji rzęs
     1. **Gęstość i pokrycie** – oceń, czy linia rzęs jest równomiernie zagęszczona, czy są luki.
     2. **Kierunek i górna linia** – oceń równość linii, kierunek rzęs, ewentualne krzyżowania.
     3. **Mapowanie i styl** – opisz, jaki efekt/styl widzisz (naturalny, doll eye, kim, itp.), jak są rozłożone długości.
     4. **Jakość przyklejenia** – czy widać sklejki, źle ułożone kępki, odstające rzęsy.
     5. **Bezpieczeństwo i komfort** – czy widać podrażnienia powieki, zaczerwienienia, zbyt ciężkie kępki itp.

     ### Wskazówki do poprawy
     - Wymień konkretne, praktyczne wskazówki dla stylistki (co zrobić lepiej przy kolejnej aplikacji).

WAŻNE:
- ZAWSZE najpierw mentalnie wybierz scenariusz A, B albo C i dopiero potem twórz odpowiedź.
- Jeśli wygląda na naturalne rzęsy bez stylizacji – traktuj to jako SCENARIUSZ B, a nie C.
- Nie wymyślaj szczegółów, których nie da się zobaczyć (np. dokładnej długości w milimetrach).
- Jeśli użytkownik wybrał język polski – pisz w 100% po polsku, jeśli angielski – w 100% po angielsku.
`;

// GET / – prosta informacja tekstowa
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

// GET /ping – endpoint health-check dla frontendu
app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// POST /analyze – główny endpoint analizy obrazu
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Brak pliku obrazu w żądaniu (pole 'image').",
      });
    }

    const language = (req.body.language || "pl").toLowerCase();
    const supportedLang = language === "en" ? "en" : "pl";

    const base64Image = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    const userInstruction =
      supportedLang === "pl"
        ? "Przeanalizuj zdjęcie zgodnie z instrukcją systemową. Na końcu nie dodawaj żadnych podsumowań typu 'jako AI nie mogę...' – po prostu raport dla stylistki."
        : "Analyse the image according to the system instructions. At the end do not add any meta-comments like 'as an AI model' – just give a clear report for the lash stylist.";

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Language: ${supportedLang}\n\n${userInstruction}` },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "";

    return res.json({
      ok: true,
      analysis: content,
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    return res.status(500).json({
      ok: false,
      error: "Wystąpił błąd po stronie serwera podczas analizy.",
    });
  }
});

// Uruchomienie serwera
app.listen(PORT, () => {
  console.log(`UPLashes AI backend listening on port ${PORT}`);
});
