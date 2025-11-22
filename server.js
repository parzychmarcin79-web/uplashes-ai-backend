// UPLashes AI – backend analizy zdjęć rzęs
// Plik: server.js (wersja CommonJS - const require)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

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

// Prosty endpoint testowy
app.get("/", (req, res) => {
  res.send("UPLashes AI backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// GŁÓWNY ENDPOINT ANALIZY
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Brak pliku ze zdjęciem. Wgraj zdjęcie jednego oka.",
      });
    }

    const language = req.body.language === "en" ? "en" : "pl";

    const base64Image = req.file.buffer.toString("base64");
    const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    // PROMPT: 3 scenariusze (extensions / natural / no eye)
    const systemPrompt =
      "You are an expert lash stylist AI (UPLashes AI). " +
      "Your job is to analyze ONE uploaded image and give advice ONLY about lashes. " +
      "The app is for UPLashes brand – keep the tone professional, warm and practical.";

    const userPrompt = `
Najpierw ZBADAJ zdjęcie i odpowiedz sobie na 3 pytania (tylko w swojej "głowie"):

1) Czy na zdjęciu widać WYRAŹNIE jedno oko lub powiekę z rzęsami?
2) Czy na tych rzęsach widać APLIKACJĘ PRZEDŁUŻANYCH RZĘS (sztuczne rzęsy), czy są to tylko NATURALNE rzęsy?
3) Czy zdjęcie jest w miarę ostre i zbliżone (nie z daleka, nie cała twarz, nie podłoga, nie przedmiot)?

Na podstawie tego wybierz JEDEN z 3 scenariuszy:

SCENARIUSZ A – BRAK OKA / NIEPOPRAWNE ZDJĘCIE
- Użyj tego scenariusza, jeśli na zdjęciu:
  - w ogóle nie ma oka,
  - oko jest zbyt daleko, bardzo małe,
  - widać zupełnie coś innego (podłoga, ściana, laptop, ręka itp.).
- Wtedy NIE dawaj żadnej analizy rzęs.
- Po prostu grzecznie napisz, że nie możesz ocenić stylizacji na podstawie tego zdjęcia
  i poproś o wgranie ZBLIŻENIA jednego oka lub powieki z rzęsami.

SCENARIUSZ B – JEST OKO, ALE TYLKO NATURALNE RZĘSY (BRAK APLIKACJI)
- Użyj tego scenariusza, jeśli widać oko/powiekę i rzęsy są NATURALNE,
  bez widocznej aplikacji salonowej.
- Wyraźnie napisz, że na zdjęciu nie ma przedłużanych rzęs.
- Zamiast oceny aplikacji:
  - oceń ogólnie naturalne rzęsy (gęstość, długość, kierunek),
  - ZAPROPONUJ 1–2 typy aplikacji, które dobrze pasowałyby do tego oka
    (np. 1:1 classic, 2D-3D light volume, 4–6D mega volume, efekt doll eye, fox eye itd.),
  - wyjaśnij krótko, dlaczego te propozycje będą korzystne (np. optyczne otwarcie oka, zagęszczenie linii, złagodzenie rysów).
- NIE udawaj, że widzisz gotową stylizację – jasno powiedz, że to naturalne rzęsy i są to propozycje.

SCENARIUSZ C – WIDOCZNA APLIKACJA PRZEDŁUŻANYCH RZĘS
- Użyj tego scenariusza, jeśli wyraźnie widzisz sztuczne rzęsy / stylizację.
- Oceń stylizację według schematu:
  1) Gęstość i pokrycie linii rzęs (czy są dziury, czy linia jest pełna),
  2) Kierunek i górna linia (czy rzęsy są równe, czy „falują”),
  3) Mapowanie i styl (np. natural, doll eye, fox; czy pasuje do oka),
  4) Jakość przyklejenia (czy widać sklejki, krzyżujące się rzęsy, odstające kępki),
  5) Bezpieczeństwo i komfort (czy nie wygląda na zbyt ciężkie, czy nie widać podrażnień).
- Potem dodaj krótki blok „Wskazówki do poprawy” – bardzo konkretne, praktyczne sugestie.

WAŻNE:
- Odpowiadaj TYLKO w jednym języku: ${
      language === "pl" ? "po polsku" : "po angielsku"
    }.
- Nie pisz, że jesteś modelem językowym.
- Nie wspominaj o scenariuszach A/B/C w odpowiedzi dla użytkownika.
- Pisz w formie krótkich akapitów z nagłówkami, ale bez nadmiaru ozdobników.
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Language: ${language === "pl" ? "Polish" : "English"}`,
            },
            {
              type: "input_text",
              text: userPrompt,
            },
            {
              type: "input_image",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    });

    const aiText =
      response.output &&
      response.output[0] &&
      response.output[0].content &&
      response.output[0].content[0] &&
      response.output[0].content[0].text
        ? response.output[0].content[0].text
        : "Nie udało się odczytać odpowiedzi AI.";

    res.json({
      ok: true,
      language,
      result: aiText,
    });
  } catch (err) {
    console.error("Błąd w /analyze:", err);
    res.status(500).json({
      ok: false,
      error: "Błąd po stronie serwera AI. Spróbuj ponownie za chwilę.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`UPLashes AI backend listening on port ${PORT}`);
});
