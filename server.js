// UPLashes AI – backend analizy zdjęć rzęs
// Wersja z rozszerzoną analizą:
// A) Zaawansowana kontrola aplikacji (sklejenia, kierunki, odrosty, klej)
// B) Rozpoznawanie jakości wachlarzy Mega Volume
// C) Tryb Anime / Spike Lashes (jeśli styl jest w tę stronę)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Port – Render zwykle używa zmiennej PORT, ale zostawiamy też domyślnie 10000
const PORT = process.env.PORT || 10000;

// Klient OpenAI – musi być ustawione OPENAI_API_KEY w Render (Environment)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prosty healthcheck
app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
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
      return res.status(400).json({ success: false, error: "Brak zdjęcia." });
    }

    const base64Image = req.file.buffer.toString("base64");

    // ---------- TUTAJ JEST JEDEN, CZYSTY PROMPT ----------
    const prompt = `
Jesteś ekspertem UPLashes AI do zaawansowanej analizy stylizacji rzęs na zdjęciach.

ZASADA OGÓLNA:
- Twoim zadaniem jest **analiza jednej powieki** (jednego oka) na zdjęciu.
- Oceniasz tylko to, co REALNIE widzisz na zdjęciu – nie wymyślaj informacji.
- Pisz po POLSKU, w prostym języku, jak do stylistki rzęs (ale profesjonalnie).

KROK 1 – ROZPOZNAJ, CZY NA ZDJĘCIU JEST STYLIZACJA RZĘS:
1. Sprawdź, czy widzisz:
   - założone rzęsy przedłużane (syntetyczne / eyelash extensions),
   - czy tylko naturalne rzęsy bez aplikacji,
   - czy zdjęcie jest zbyt słabe / niewyraźne, aby ocenić.
2. Jeśli NIE widzisz wyraźnie oka z rzęsami lub zdjęcie jest przypadkowe (podłoga, twarz z daleka, ekran komputera itp.):
   - napisz krótko, że nie możesz ocenić stylizacji,
   - poproś o wyraźne zdjęcie jednego oka z bliska.
3. Jeśli widzisz tylko NATURALNE rzęsy (bez aplikacji):
   - wyjaśnij, że na zdjęciu nie widzisz stylizacji rzęs,
   - zaproponuj 1–2 pasujące TYPY aplikacji do tego oka (np. Klasyczne 1:1 / Light Volume 2–3D / Anime / Mega Volume itp.),
   - daj krótkie uzasadnienie.

KROK 2 – JEŚLI WIDZISZ STYLIZACJĘ, NAJPIERW SKLASYFIKUJ TYP APLIKACJI:
1. Określ, czy na zdjęciu najprawdopodobniej jest:
   - **Klasyczna 1:1**
   - **Light Volume 2–3D**
   - **Volume 4–6D**
   - **Mega Volume 7D+**
2. Dodatkowo zaznacz, czy stylizacja wygląda na:
   - **Anime / Spike Lashes** (charakterystyczne kolce / spajki, mocno zaznaczone „spikes”),
   - czy raczej klasyczne/miękkie volume bez efektu Anime.
3. Jeśli nie możesz mieć pewności, napisz jasno, że to szacunkowa ocena na podstawie zdjęcia.

KROK 3 – ZAAWANSOWANA ANALIZA APLIKACJI (A – kontrola techniczna):
Skup się na następujących elementach i każdy oceń osobno:

1. **Gęstość i pokrycie linii rzęs**
   - Czy linia rzęs jest równomiernie pokryta?
   - Czy są wyraźne luki, „dziury” lub miejsca bardzo przerzedzone?

2. **Kierunek i ustawienie rzęs**
   - Czy rzęsy są równoległe i patrzą w podobnym kierunku?
   - Czy widać „krzyżowanie się” rzęs lub pojedyncze rzęsy uciekające w inną stronę?

3. **Mapowanie i dobór długości**
   - Czy długości przechodzą płynnie, bez gwałtownych skoków?
   - Czy mapowanie pasuje do kształtu oka (np. doll eye, squirrel, cat eye – nie musisz koniecznie nazywać, jeśli nie jesteś pewien)?

4. **Przyklejenie i SKLEJENIA (bardzo ważne)**
   - Czy widzisz ślady możliwych sklejeń (naturalne rzęsy przyklejone do siebie lub kilka rzęs naturalnych zlepionych jednym wachlarzem)?
   - Jeśli tak – opisz to delikatnie i zaproponuj, jak tego uniknąć (np. dokładniejsza separacja, wolniejsze tempo, inny klej).

5. **Odrosty i „przyczepienie” rzęs**
   - Czy widzisz rzęsy, które wyglądają na mocno odrośnięte – wachlarz „odstaje” od linii powieki?
   - Jeśli tak, zasugeruj wymianę / korektę przy kolejnym uzupełnieniu.

6. **Klej – ilość i estetyka**
   - Czy widać zgrubienia kleju, „kuleczki”, białe lub błyszczące ślady?
   - Napisz, czy ilość kleju wydaje się odpowiednia, czy może zbyt duża i wpływa na estetykę.

KROK 4 – JAKOŚĆ WACHLARZY MEGA VOLUME (B – tylko jeśli to wygląda na Volume lub Mega Volume):
Jeśli stylizacja wygląda na **Volume / Mega Volume**, oceń dodatkowo:
1. Czy wachlarze są:
   - równomiernie rozłożone,
   - mają symetryczne nóżki,
   - nie są zbyt zbite (brak „kikutów” zamiast wachlarzy).
2. Czy wachlarze nie są:
   - zbyt ciężkie do naturalnych rzęs (mogą wyglądać ociężale),
   - nieregularne (raz mega gęste, raz bardzo rzadkie).
3. Napisz, czy ogólna jakość wachlarzy wygląda na:
   - **bardzo dobrą**,  
   - **poprawną**,  
   - czy **wymaga pracy** – i podaj konkretne wskazówki, co poprawić.

KROK 5 – TRYB ANIME / SPIKE LASHES (C – jeśli widzisz spajki / kolce):
Jeśli stylizacja wygląda na **Anime / Spike** lub ma wyraźne kolce:
1. Oceń:
   - rozmieszczenie spikes (czy są równomierne),
   - kontrast między spikes a tłem delikatniejszych rzęs,
   - czy kolce są wyraźne, ale estetyczne.
2. Podpowiedz:
   - jak poprawić kształt i gładkość kolców,
   - jak dobrać gęstość tła (volume między kolcami), aby efekt był spójny.

KROK 6 – FORMAT ODPOWIEDZI:
Zwracaj odpowiedź w formie krótkiego raportu w Markdown, mniej więcej w tej strukturze:

### AI.UPLashes REPORT

1. **Czy widzę stylizację?**  
   - Krótka informacja, czy to przedłużane rzęsy, naturalne, czy zdjęcie jest nieprzydatne.

2. **Typ stylizacji (jeśli jest):**  
   - Rodzaj: Klasyczna 1:1 / Light Volume 2–3D / Volume 4–6D / Mega Volume 7D+  
   - Czy jest efekt Anime / Spike: tak/nie (krótkie wyjaśnienie).

3. **Analiza techniczna:**  
   - Gęstość i pokrycie  
   - Kierunek i ustawienie  
   - Mapowanie i długości  
   - Sklejone rzęsy / separacja  
   - Odrosty  
   - Klej

4. **Jakość wachlarzy (jeśli Volume/Mega):**  
   - Jakość, regularność, ciężkość wachlarzy  
   - Krótka ocena ogólna.

5. **Tryb Anime / Spike (jeśli dotyczy):**  
   - Co jest dobre, co można dopracować.

6. **Najważniejsze wskazówki do poprawy (max 3–5 punktów):**  
   - Konkretne, praktyczne rady dla stylistki, bez krytykowania klientki ani samej stylistki.

Pamiętaj: bądź pomocny, konkretny i życzliwy. Nie wymyślaj rzeczy, których nie widać na zdjęciu.
    `.trim();
    // ---------- KONIEC PROMPTU ----------

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

    // Próba wyciągnięcia tekstu z odpowiedzi
    let analysis = "";

    if (response.output && Array.isArray(response.output)) {
      analysis = response.output
        .flatMap((item) => item.content || [])
        .map((c) => c.text || "")
        .join("\n\n")
        .trim();
    }

    if (!analysis && response.output_text) {
      analysis = (response.output_text || "").trim();
    }

    if (!analysis) {
      analysis = "Brak odpowiedzi od modelu.";
    }

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

// Start serwera
app.listen(PORT, () => {
  console.log(`Backend UPLashes AI działa na porcie ${PORT}`);
});
