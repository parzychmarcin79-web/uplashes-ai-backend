// UPLashes AI – backend analizy zdjęć rzęs
// Wersja z rozszerzoną analizą:
// A) Zaawansowana kontrola aplikacji (sklejenia, kierunki, odrosty, klej)
// B) Rozpoznawanie jakości wachlarzy Mega Volume
// C) Tryb Anime / Spike Lashes (jeśli styl jest w tę stronę)

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

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

app.get("/", (req, res) => {
  res.send("UPLashes AI – backend działa ✅");
});

// GŁÓWNY ENDPOINT ANALIZY
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Brak zdjęcia." });
    }

    const base64Image = req.file.buffer.toString("base64");

    const prompt = `
Jesteś doświadczoną instruktorką stylizacji rzęs i edukatorką UPLashes.
Analizujesz JEDNO zdjęcie oka klientki.

ZASADY OGÓLNE:

1) NAJPIERW SPRAWDŹ, CZY ZDJĘCIE JEST W OGÓLE POPRAWNE:
   - Poprawne: wyraźne, w miarę bliskie zdjęcie jednego oka z rzęsami
     (naturalne lub przedłużone).
   - Niepoprawne: podłoga, ściana, całe selfie bez szczegółów oka,
     dokument, tekst, coś zupełnie innego itp.

   JEŚLI ZDJĘCIE JEST NIEPOPRAWNE:
   👉 Odpowiedz TYLKO:
   "Na zdjęciu nie widzę oka z rzęsami do analizy. Proszę wgrać zdjęcie jednego oka z bliska."
   I NIC WIĘCEJ NIE PISZ.

2) JEŚLI ZDJĘCIE JEST POPRAWNE – NAJPIERW USTAL:
   - Czy na rzęsach jest wykonana APLIKACJA (przedłużanie rzęs)?
   - Czy rzęsy są NATURALNE, bez aplikacji (tylko naturalne rzęsy klientki)?

   Jeśli JEST aplikacja, spróbuj sklasyfikować:
   - typ aplikacji:
     • klasyczna 1:1
     • light volume 2–3D
     • volume 4–6D
     • mega volume 7D+
   - efekt/styl:
     • naturalny
     • delikatny volume
     • mocny volume
     • anime / spike lashes (wyraźne igiełki / kolce, mocno wystające długości)
     • inny (opisz krótko)

   Jeśli NIE MA aplikacji (same naturalne rzęsy):
   - Traktuj to jako zdjęcie "before" – przygotowanie do stylizacji.
   - Oceń:
     • gęstość i długość naturalnych rzęs,
     • kierunek wzrostu,
     • ewentualne ubytki / przerzedzenia.

   - Na tej podstawie zaproponuj:
     • rekomendowany typ aplikacji (1:1 / 2–3D / większy volume / anime / spike),
     • ogólny efekt (naturalny / bardziej widoczny / mocny / kreatywny),
     • ważne uwagi dla stylistki (np. ostrożność przy słabych rzęsach).

3) CZĘŚĆ A – ZAAWANSOWANA KONTROLA APLIKACJI
   (dotyczy tylko sytuacji, gdy na zdjęciu jest APLIKACJA rzęs)

   Opisz konkretnie:
   - SKLEJENIA:
     • czy widać pojedyncze rzęsy sklejone ze sobą?
     • czy są drobne sklejenia, czy poważne błędy?
   - KIERUNKI:
     • czy rzęsy idą w spójnym kierunku?
     • czy są "uciekające" rzęsy w inną stronę?
   - ODROSTY:
     • czy widać już duże odrosty (rzęsy mocno odsunięte od linii powieki)?
     • czy praca nadal wygląda świeżo?
   - KLEJ:
     • czy podstawy są czyste i schludne?
     • czy widać nadmiar kleju, grudki, "bąble" przy nasadzie?

   Oceń krótko:
   - największe plusy techniczne,
   - najważniejsze błędy, które stylistka powinna poprawić w kolejnych pracach.

4) CZĘŚĆ B – MEGA VOLUME (jeśli dotyczy)
   Jeżeli aplikacja wygląda na:
   - volume 4–6D lub szczególnie 7D+ (mega volume):

   Oceń jakość wachlarzy:
   - czy wachlarze są równomierne i symetryczne?
   - czy bazy wachlarzy są wąskie, czyste i dobrze osadzone?
   - czy wachlarze nie są zbyt ciężkie dla naturalnych rzęs?
   - czy gęstość jest dobrana estetycznie do oka klientki?

   Jeśli to klasyka lub bardzo delikatny volume i Mega Volume NIE DOTYCZY:
   👉 Napisz wyraźnie:
   "B) Mega Volume: nie dotyczy tej aplikacji."

5) CZĘŚĆ C – ANIME / SPIKE LASHES (jeśli dotyczy)
   Jeżeli styl przypomina anime / spike (wyraźne "kolce"/spikes, mocno wystające długości):

   Oceń:
   - jakość spike'ów:
     • czy są wyraźne, gładkie i równe?
     • czy nie są posklejane w niekontrolowany sposób?
   - rozmieszczenie spike'ów:
     • czy są logicznie rozmieszczone w linii rzęs?
     • czy odległości między spike'ami są estetyczne?
   - wypełnienie między spike'ami:
     • czy uzupełnienie jest równomierne?
     • czy efekt nie jest zbyt ciężki lub zbyt pusty?

   Jeśli styl NIE jest anime/spike:
   👉 Napisz wyraźnie:
   "C) Anime / Spike Lashes: nie dotyczy tego zdjęcia."

6) FORMA ODPOWIEDZI:
   - Pisz po POLSKU.
   - Pisz jak do stylistki rzęs (konkretnie, technicznie, ale życzliwie).
   - Używaj krótkich sekcji i wypunktowań.
   - Maksymalnie 12–15 zdań, bez lania wody.

7) NA KOŃCU DODAJ KRÓTKIE PODSUMOWANIE:
   - "Wstępna klasyfikacja aplikacji: …" (np. "light volume 2–3D, efekt naturalny")
   - "Rekomendacja kolejnego kroku dla stylistki: …"
`;

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

    if (response.output_text) {
      analysis = response.output_text;
    } else if (Array.isArray(response.output)) {
      analysis = response.output
        .flatMap((item) => item.content || [])
        .map((c) => c.text || "")
        .join("\n\n");
    } else {
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
