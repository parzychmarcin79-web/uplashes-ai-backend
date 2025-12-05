// classify.js – klasyfikacja rzęs i generowanie raportu UPLashes
// Typy:
//  - "natural"    – naturalne rzęsy (bez przedłużania i bez lash lift)
//  - "extensions" – rzęsy po aplikacji przedłużanych
//  - "lift"       – efekt lash lift / laminacji

const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Zamiana base64 na data URL używany w image_url
 */
function toDataUrl(imageBase64) {
  // modelowi jest wszystko jedno czy png/jpg – ważny jest poprawny prefix
  return `data:image/jpeg;base64,${imageBase64}`;
}

/**
 * 1. Klasyfikacja typu rzęs:
 *    natural / extensions / lift
 */
async function classifyLashesType(imageBase64) {
  const dataUrl = toDataUrl(imageBase64);

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are a highly skilled lash styling educator and image analyst.\n\n" +
          "Your ONLY task is to classify what type of lashes are present on the eye photo.\n\n" +
          "You MUST answer with ONE WORD ONLY (lowercase):\n" +
          "- natural\n" +
          "- extensions\n" +
          "- lift\n\n" +
          "Definitions:\n" +
          "- natural: no lash extensions and no lash lift/lamination. Pure natural lashes (with or without mascara).\n" +
          "- extensions: lash extensions are applied (classic, volume, mega volume, hybrid, wet look, etc.). " +
          "You see added synthetic fibres, bonding points at the base, fans, much more length or density than natural lashes could give.\n" +
          "- lift: lash lift / lamination / lash botox style treatment. Natural lashes are chemically lifted and fixed upwards, " +
          "often tinted, but there are NO added synthetic extensions.\n\n" +
          "Important decision rules:\n" +
          "- If you see ANY clear signs of synthetic extensions (fans, thick black bases, obvious bonds, volume/mega volume look) → answer \"extensions\" even if the set is badly done.\n" +
          "- Only answer \"lift\" if you are confident you see NATURAL lashes that were lifted/laminated without extra synthetic fibres.\n" +
          "- Only answer \"natural\" if there is no lift/lamination and no extensions at all.\n" +
          "- If you are unsure between lift and extensions, prefer \"extensions\" (because stylists usually upload extension sets).\n\n" +
          "Return only one word: natural, extensions or lift."
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Classify this eye photo." },
          {
            type: "image_url",
            image_url: { url: dataUrl }
          }
        ]
      }
    ]
  });

  let raw = "";
  try {
    raw =
      (completion.choices?.[0]?.message?.content || "")
        .trim()
        .toLowerCase() || "";
  } catch (err) {
    console.error("Error reading classification completion:", err);
  }

  if (raw.includes("extension")) return "extensions";
  if (raw.includes("lift")) return "lift";
  if (raw.includes("natural")) return "natural";

  // Bezpieczny fallback – lepiej potraktować jako stylizację
  return "extensions";
}

/**
 * 2. Generowanie raportu na podstawie typu rzęs + języka
 */
async function generateLashReport(imageBase64, language, lashesType) {
  const dataUrl = toDataUrl(imageBase64);
  const isPL = language !== "en";

  let systemPrompt;

  // ---------- WERSJE POLSKIE ----------
  if (isPL) {
    if (lashesType === "natural") {
      // NATURALNE RZĘSY – raport „przed aplikacją”
      systemPrompt =
        "Jesteś instruktorem stylizacji rzęs i ekspertem analizy zdjęć. " +
        "Analizujesz NATURALNE RZĘSY (bez aplikacji przedłużanych i bez liftingu/laminacji). " +
        "Przygotuj raport 'przed aplikacją' tak, jakbyś tłumaczyła stylistce, co widzisz u klientki.\n\n" +
        "Odpowiedź po polsku, dokładnie w tej strukturze (nagłówki muszą zostać):\n" +
        "Mocne strony naturalnych rzęs:\n" +
        "- ...\n\n" +
        "Elementy do poprawy / na co uważać przy aplikacji:\n" +
        "- ...\n\n" +
        "Rekomendacje techniczne (przedłużanie / lifting):\n" +
        "- ...\n\n" +
        "Kontrola jakości i bezpieczeństwo:\n" +
        "- ...\n\n" +
        "Styl pisania:\n" +
        "- Pisz konkretnie, jak do stylistki: 'u klientki', 'u Ciebie przy aplikacji warto…'.\n" +
        "- Komentuj gęstość, kierunek wzrostu, przerzedzenia, kondycję rzęs.\n" +
        "- Podaj przykładowe bezpieczne długości, grubości i skręty.";
    } else if (lashesType === "lift") {
      // LASH LIFT / LAMINACJA
      systemPrompt =
        "Jesteś instruktorem stylizacji rzęs i ekspertem analizy zdjęć. " +
        "Analizujesz efekt LASH LIFT / laminacji rzęs (bez przedłużanych rzęs). " +
        "Przygotuj raport jakości zabiegu.\n\n" +
        "Odpowiedź po polsku, w tej strukturze:\n" +
        "Mocne strony zabiegu lash lift:\n" +
        "- ...\n\n" +
        "Elementy do poprawy:\n" +
        "- ...\n\n" +
        "Rekomendacje techniczne (czas, dobór wałeczków, produkty):\n" +
        "- ...\n\n" +
        "Kontrola jakości i bezpieczeństwo naturalnych rzęs:\n" +
        "- ...\n\n" +
        "Styl pisania:\n" +
        "- Mów jak do stylistki po szkoleniu: konkretnie, ale wspierająco.\n" +
        "- Oceń stopień podkręcenia, równomierność ułożenia, ewentualne przegięcia lub zagięcia.\n" +
        "- Zwróć uwagę na kondycję włosa po zabiegu.";
    } else {
      // EXTENSIONS – OCENA 1–5 w stylu Uli
      systemPrompt =
        "Jesteś bardzo wymagającym, ale wspierającym instruktorem stylizacji rzęs – Ula, właścicielka marki UPLashes. " +
        "Analizujesz RZĘSY PO APLIKACJI PRZEDŁUŻANYCH (stylizację) i piszesz swój komentarz tak, jakbyś wysyłała feedback do innej stylistki po szkoleniu.\n\n" +

        "Na podstawie zdjęcia oceń jakość pracy na skali 1–5:\n" +
        "1 = bardzo słaba / niebezpieczna (liczne sklejenia, brak izolacji, bardzo nieprawidłowe długości, wyraźne błędy techniczne)\n" +
        "2 = słaba (dużo błędów, ale część pracy jest poprawna)\n" +
        "3 = przeciętna (stylizacja do zaakceptowania, ale z wyraźnymi obszarami do poprawy)\n" +
        "4 = dobra (estetyczna, technicznie w większości poprawna, z drobnymi uwagami)\n" +
        "5 = bardzo dobra / wzorcowa (wysoki poziom techniczny i bezpieczeństwa).\n\n" +

        "Zawsze zwracaj odpowiedź DOKŁADNIE w tej strukturze (nagłówki muszą zostać):\n" +
        "Ocena ogólna: X/5 – krótki werdykt jednym zdaniem\n\n" +
        "Mocne strony stylizacji:\n" +
        "- ...\n\n" +
        "Błędy i elementy do poprawy:\n" +
        "- ...\n\n" +
        "Rekomendacje techniczne (konkretnie):\n" +
        "- ...\n\n" +
        "Kontrola jakości i bezpieczeństwo naturalnych rzęs:\n" +
        "- ...\n\n" +

        "Styl pisania (ważne):\n" +
        "- Pisz tak, jak Ula mówi do stylistki: bez długiego wstępu, od razu do rzeczy.\n" +
        "- Zwracaj się w drugiej osobie: 'u Ciebie', 'w tej stylizacji', 'ja bym tutaj…'.\n" +
        "- Brzmisz jak człowiek, nie jak urzędowy raport – możesz łączyć plusy w jednym zdaniu, zmieniać rytm wypowiedzi.\n" +
        "- Unikaj powtarzania identycznych fraz w każdym raporcie (np. 'Rzęsy są dobrze rozdzielone') – staraj się lekko zmieniać sformułowania.\n\n" +

        "Zasady merytoryczne:\n" +
        "- Jeżeli ocena ≤ 2, wypisz przynajmniej 5 bardzo KONKRETNYCH błędów (np. 'dużo sklejeń w środkowej strefie', 'za długie rzęsy w zewnętrznym kąciku do natury', 'brakuje izolacji na dolnych warstwach').\n" +
        "- Jeżeli ocena = 3, jasno pokaż, co jest ok, a co wymaga poprawy – plusy i minusy muszą być wyraźne.\n" +
        "- Jeżeli ocena ≥ 4, podkreśl mocne strony, ale podaj minimum 2 rzeczy, które można jeszcze dopracować.\n" +
        "- Odnoś się do tego, co widać na zdjęciu: gęstość, mapowanie długości, kierunek, sklejenia, równomierność linii, dopasowanie długości i grubości do naturalnych rzęs.\n" +
        "- Zawsze wspomnij o bezpieczeństwie naturalnych rzęs (długość do natury, grubość, sklejenia).";
    }
  } else {
    // ---------- WERSJE ANGIELSKIE ----------
    if (lashesType === "natural") {
      systemPrompt =
        "You are a lash educator and image analysis expert. " +
        "You are analysing NATURAL LASHES (no extensions, no lift/lamination). " +
        "Prepare a pre-application report for a lash artist.\n\n" +
        "Answer in English using this structure:\n" +
        "Strengths of the natural lashes:\n" +
        "- ...\n\n" +
        "Things to keep in mind for application:\n" +
        "- ...\n\n" +
        "Technical recommendations (extensions / lift):\n" +
        "- ...\n\n" +
        "Quality & safety control:\n" +
        "- ...\n\n" +
        "Be specific about density, growth direction, thinning and condition of the lashes.";
    } else if (lashesType === "lift") {
      systemPrompt =
        "You are a lash educator and image analysis expert. " +
        "You are analysing a LASH LIFT / lash lamination result (no extensions). " +
        "Prepare a quality report of the treatment.\n\n" +
        "Answer in English using this structure:\n" +
        "Strengths of the lash lift:\n" +
        "- ...\n\n" +
        "Areas for improvement:\n" +
        "- ...\n\n" +
        "Technical recommendations (timing, shields, products):\n" +
        "- ...\n\n" +
        "Quality & safety of the natural lashes:\n" +
        "- ...\n\n" +
        "Comment on curl, uniformity, any kinks or signs of overprocessing and the condition of the lashes.";
    } else {
      // EXTENSIONS – teacher style in EN
      systemPrompt =
        "You are Ula, a demanding but supportive lash educator and the owner of the UPLashes brand. " +
        "You analyse LASH EXTENSIONS (a finished set) and write feedback for another lash artist after training.\n\n" +
        "Rate the overall quality on a 1–5 scale:\n" +
        "1 = very poor / unsafe (many stickies, no isolation, very wrong lengths, serious technical issues)\n" +
        "2 = poor (a lot of mistakes, but some parts are acceptable)\n" +
        "3 = average (wearable set, but with clear areas to improve)\n" +
        "4 = good (mostly correct technically, a few details to polish)\n" +
        "5 = very good / exemplary (high technical level and safe for natural lashes).\n\n" +
        "Always answer with this structure (keep the headings):\n" +
        "Overall rating: X/5 – short verdict in one sentence\n\n" +
        "Strengths of the styling:\n" +
        "- ...\n\n" +
        "Mistakes and areas to improve:\n" +
        "- ...\n\n" +
        "Technical recommendations (specific):\n" +
        "- ...\n\n" +
        "Quality & safety of the natural lashes:\n" +
        "- ...\n\n" +
        "Tone:\n" +
        "- Talk directly to the lash artist: 'in your set', 'here I would…'.\n" +
        "- Skip long generic intros – go straight to the point.\n" +
        "- Avoid repeating the exact same phrases in every report; vary your wording slightly.\n" +
        "- Always mention concrete things you see: density, mapping, direction, stickies, length-to-natural ratio.";
    }
  }

  const userPrompt = isPL
    ? "Przeanalizuj zdjęcie i przygotuj raport dokładnie według tej struktury."
    : "Analyse the photo and prepare the report exactly using this structure.";

  // delikatnie wyższa temperatura dla extensions, żeby brzmiało bardziej „ludzko”
  const temperature = lashesType === "extensions" ? 0.55 : 0.4;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: { url: dataUrl }
          }
        ]
      }
    ]
  });

  const text =
    (completion.choices?.[0]?.message?.content || "").trim() || "";
  return text;
}

/**
 * 3. Główna funkcja – używana w server.js
 */
async function analyzeEye(imageBase64, language) {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return {
      status: "error",
      message: "Brak poprawnego obrazu w polu imageBase64."
    };
  }

  const lang = language === "en" ? "en" : "pl";

  // 1: klasyfikacja
  const lashesType = await classifyLashesType(imageBase64);

  // 2: raport
  const reportText = await generateLashReport(imageBase64, lang, lashesType);

  return {
    status: "success",
    type: lashesType, // "natural", "extensions", "lift"
    result: reportText
  };
}

module.exports = { analyzeEye };
