// UPLashes AI – backend analizy zdjęć rzęs
// Wersja z rozszerzoną analizą:
// A) Zaawansowana kontrola aplikacji (sklejenia, kierunki, odrosty, klej)
// B) Rozpoznawanie jakości wachlarzy Mega Volume
// C) Tryb Anime / Spike Lashes

import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// --- Klient OpenAI ---

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Healthcheck ---

app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "UPLashes AI backend działa i odpowiada na /ping",
  });
});

// --- Prompt do analizy ---

function buildPrompt() {
  return `
Jesteś ekspertem UPLashes AI do zaawansowanej analizy stylizacji rzęs na zdjęciach.

ZASADA OGÓLNA:
- Analizujesz JEDNO oko (jedną powiekę).
- Oceniasz TYLKO to, co REALNIE widać na zdjęciu – nie wymyślaj.
- Pisz po POLSKU, jak do stylistki rzęs: konkretnie, technicznie, ale życzliwie.

KROK 1 – CZY W OGÓLE WIDZĘ OKO Z RZĘSAMI?
1. Sprawdź, czy zdjęcie pokazuje jedno oko z bliska.
2. Jeśli widać coś innego (podłoga, ekran, selfie z daleka itp.):
   → Odpowiedz TYLKO:
   "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
   I NIC WIĘCEJ NIE PISZ.

KROK 2 – CZY JEST APLIKACJA, CZY SAME NATURALNE RZĘSY?
1. Ustal:
   - czy na rzęsach jest APLIKACJA (przedłużane rzęsy),
   - czy są tylko NATURALNE rzęsy bez aplikacji,
   - czy zdjęcie jest zbyt słabe, żeby to ocenić.
2. Jeśli są tylko NATURALNE rzęsy:
   - napisz, że nie widzisz stylizacji rzęs,
   - zaproponuj 1–2 pasujące TYPY aplikacji do tego oka
     (np. klasyczna 1:1 / light volume 2–3D / mocniejszy volume / anime / spike),
   - krótko uzasadnij, dlaczego.

KROK 3 – TYP APLIKACJI (jeśli widzisz stylizację)
Na podstawie zdjęcia spróbuj oszacować:
1. Rodzaj aplikacji:
   - klasyczna 1:1
   - light volume 2–3D
   - volume 4–6D
   - mega volume 7D+
2. Styl / efekt:
   - naturalny
   - delikatny volume
   - mocny volume
   - anime / spike lashes (charakterystyczne „kolce” / spikes)
   - inny (opisz krótko)
Jeśli nie masz pewności – zaznacz, że to szacunek na podstawie zdjęcia.

KROK 4 – CZĘŚĆ A: ZAawansowana KONTROLA APLIKACJI (tylko gdy jest aplikacja)
Oceń osobno:

1. GĘSTOŚĆ I POKRYCIE
   - czy linia rzęs jest równomiernie pokryta?
   - czy są luki, „dziury”, bardzo rzadkie miejsca?

2. KIERUNEK I USTAWIENIE
   - czy rzęsy idą w podobnym kierunku?
   - czy widać krzyżowanie, pojedyncze rzęsy uciekające w inną stronę?

3. MAPOWANIE I DŁUGOŚCI
   - czy długości przechodzą płynnie, bez skoków?
   - czy mapowanie pasuje do kształtu oka (np. doll eye / cat eye – tylko jeśli jesteś w miarę pewien)?

4. SKLEJENIA
   - czy widzisz możliwe sklejenia (kilka naturalnych rzęs złączonych jednym wachlarzem)?
   - jeśli tak – opisz to delikatnie i podpowiedz, jak tego unikać (lepsza separacja, tempo, praca na mniejszej ilości kleju).

5. ODROSTY
   - czy część rzęs wygląda na mocno odrośnięte?
   - czy stylizacja nadal wygląda świeżo?

6. KLEJ
   - czy widać zgrubienia kleju, „kulki”, bardzo błyszczące podstawy?
   - oceń, czy ilość kleju jest ok, czy może psuje estetykę.

KROK 5 – CZĘŚĆ B: JAKOŚĆ WACHLARZY VOLUME / MEGA VOLUME
Tę część stosuj tylko wtedy, gdy stylizacja wygląda na volume 4–6D lub mega volume 7D+.

1. Oceń wachlarze:
   - czy są równomiernie rozłożone?
   - czy nóżki są w miarę równe i wąskie?
   - czy wachlarze nie są „kikutami” (zbite, bez przestrzeni)?

2. Oceń ciężkość:
   - czy wachlarze nie są zbyt ciężkie dla naturalnych rzęs?
   - czy gęstość jest estetyczna dla tego oka?

Na końcu dodaj prostą ocenę:
   - bardzo dobra jakość,
   - poprawna,
   - wymaga pracy (podaj konkrety).

Jeśli stylizacja NIE jest volume/mega:
   → Napisz wyraźnie: "B) Mega Volume: nie dotyczy tej aplikacji."

KROK 6 – CZĘŚĆ C: ANIME / SPIKE LASHES
Jeśli styl wygląda na anime / spike (wyraźne kolce):

1. Oceń:
   - jakość spike’ów (czy są gładkie, równe, czyste),
   - rozmieszczenie (czy odstępy są logiczne i estetyczne),
   - wypełnienie między spike’ami (czy nie jest zbyt pusto albo zbyt ciężko).

2. Podpowiedz:
   - co poprawić w kształcie i gładkości kolców,
   - jak dobrać gęstość tła (volume między kolcami).

Jeśli styl nie jest anime/spike:
   → Napisz: "C) Anime / Spike Lashes: nie dotyczy tego zdjęcia."

KROK 7 – FORMAT ODPOWIEDZI (Markdown)

Zwróć raport w tej strukturze:

### AI.UPLashes REPORT

1. **Czy widzę stylizację?**  
   - krótka informacja, czy to aplikacja / naturalne / zdjęcie nieprzydatne.

2. **Typ stylizacji (jeśli jest):**  
   - Rodzaj: 1:1 / 2–3D / 4–6D / 7D+  
   - Styl: naturalny / volume / anime / spike (z krótkim wyjaśnieniem).

3. **Analiza techniczna (część A):**  
   - Gęstość i pokrycie  
   - Kierunek  
   - Mapowanie i długości  
   - Sklejone rzęsy / separacja  
   - Odrosty  
   - Klej

4. **Wachlarze Volume/Mega (część B – jeśli dotyczy):**  
   - jakość, regularność, ciężkość wachlarzy  
   - krótka ocena ogólna.

5. **Anime / Spike (część C – jeśli dotyczy):**  
   - co jest dobre, co można poprawić.

6. **Najważniejsze wskazówki (3–5 punktów):**  
   - konkretne rady dla stylistki (bez krytykowania klientki).

Pisz zwięźle, maks. ok. 12–15 zdań, bez lania wody.
`;
}

// --- Pomocnicza funkcja do wyciągania tekstu z odpowiedzi ---

function extractTextFromResponse(response) {
  if (response.output_text && response.output_text.trim().length > 0) {
    return response.output_text.trim();
  }

  if (Array.isArray(response.output)) {
    const text = response.output
      .flatMap((item) => item.content || [])
      .map((c) => c.text || "")
      .join("\n\n")
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  return "Analiza zakończona, ale nie otrzymano szczegółowego raportu.";
}

// --- GŁÓWNY ENDPOINT ANALIZY ---

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Brak zdjęcia do analizy.",
      });
    }

    const base64Image = req.file.buffer.toString("base64");
    const prompt = buildPrompt();

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
    });

    const analysis = extractTextFromResponse(response);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Błąd w /analyze:", error);
    res.status(500).json({
      success: false,
      error: "Błąd serwera podczas analizy zdjęcia.",
      details: error.message,
    });
  }
});

// --- Start serwera ---

app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
