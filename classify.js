// classify.js – klasyfikacja rzęs i generowanie raportu
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
  // modelowi jest wszystko jedno czy png/jpg – ważne, żeby był poprawny prefix
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
          "You are a lash styling expert and image analyst.\n\n" +
          "Your ONLY task is to classify what type of lashes are present on the eye photo.\n\n" +
          "You MUST answer with ONE WORD ONLY (lowercase):\n" +
          "- natural\n" +
          "- extensions\n" +
          "- lift\n\n" +
          "Definitions:\n" +
          "- natural: no lash extensions, no lash lift/lamination. Pure natural lashes (with or without mascara).\n" +
          "- extensions: lash extensions applied (classic, volume, hybrid, any mapping). Visible added length, density, fans, bonding points.\n" +
          "- lift: lash lift / lamination / lash botox style treatment. Natural lashes are chemically lifted and fixed upwards, often with tint, but without added extensions.\n\n" +
          "Rules:\n" +
          "- If you clearly see added synthetic lashes → answer \"extensions\".\n" +
          "- If lashes are noticeably lifted upwards in a uniform arc, but there are NO synthetic extensions → answer \"lift\".\n" +
          "- If there is no sign of extensions or lift/lamination → answer \"natural\".\n" +
          "- If you are unsure, choose the MOST LIKELY type.\n" +
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

  // Bezpieczny fallback – większość zdjęć w użyciu to stylizacje
  return "extensions";
}

/**
 * 2. Generowanie raportu na podstawie typu rzęs + języka + trybu raportu
 *    reportMode: "standard" | "detailed" | "pro"
 */
async function generateLashReport(imageBase64, language, lashesType, reportMode = "standard") {
  const dataUrl = toDataUrl(imageBase64);
  const isPL = language !== "en";

  // podpowiedź jak długi ma być raport
  let lengthHintPL;
  let lengthHintEN;

  if (reportMode === "pro") {
    lengthHintPL =
      "Raport ma być NAJBARDZIEJ ROZBUDOWANY. " +
      "W każdej sekcji wypisz 5–8 punktów, każdy punkt może mieć 1–2 zdania. " +
      "Używaj języka eksperckiego (instruktor, szkolenie PRO), możesz podawać konkretne zakresy (np. długości, grubości, skręty).";
    lengthHintEN =
      "Make this the MOST DETAILED report. " +
      "For each section write 5–8 bullet points, each 1–2 sentences. " +
      "Use expert language (educator / PRO training level) and include numeric ranges where relevant (lengths, thickness, curls).";
  } else if (reportMode === "detailed") {
    lengthHintPL =
      "Raport ma być SZCZEGÓŁOWY. " +
      "W każdej sekcji wypisz 4–6 punktów, większość punktów może mieć 1–2 zdania.";
    lengthHintEN =
      "Make the report DETAILED. " +
      "For each section write 4–6 bullet points, most points can be 1–2 sentences.";
  } else {
    // standard
    lengthHintPL =
      "Raport ma być ZWIĘZŁY, ale merytoryczny. " +
      "W każdej sekcji wypisz 2–4 krótkie punkty (po jednym zdaniu).";
    lengthHintEN =
      "Keep the report CONCISE but informative. " +
      "For each section write 2–4 short bullet points (one sentence each).";
  }

  let systemPrompt;

  if (isPL) {
    // POLSKI
    if (lashesType === "natural") {
      systemPrompt =
        "Jesteś instruktorem stylizacji rzęs i ekspertem analizy zdjęć. " +
        "Analizujesz NATURALNE RZĘSY (bez aplikacji przedłużanych i bez liftingu/laminacji). " +
        "Przygotuj raport 'przed aplikacją'.\n\n" +
        "Odpowiedź po polsku, w tej strukturze (zachowaj dokładnie te nagłówki):\n" +
        "Mocne strony naturalnych rzęs:\n" +
        "- ...\n\n" +
        "Elementy do poprawy:\n" +
        "- ...\n\n" +
        "Rekomendacje techniczne (przedłużanie / lifting):\n" +
        "- ...\n\n" +
        "Kontrola jakości i bezpieczeństwo:\n" +
        "- ...\n\n" +
        "Zasady:\n" +
        "- Nie pisz, że aplikacja została już wykonana.\n" +
        "- Skup się na gęstości, kondycji, kierunku wzrostu, przerzedzeniach.\n" +
        "- W rekomendacjach sugeruj bezpieczne długości, grubości i skręty.\n\n" +
        lengthHintPL;
    } else if (lashesType === "lift") {
      systemPrompt =
        "Jesteś instruktorem stylizacji rzęs i ekspertem analizy zdjęć. " +
        "Analizujesz efekt LASH LIFT / laminacji rzęs (bez przedłużanych rzęs). " +
        "Przygotuj raport jakości zabiegu.\n\n" +
        "Odpowiedź po polsku, w tej strukturze (zachowaj dokładnie te nagłówki):\n" +
        "Mocne strony zabiegu lash lift:\n" +
        "- ...\n\n" +
        "Elementy do poprawy:\n" +
        "- ...\n\n" +
        "Rekomendacje techniczne (czas, dobór wałeczków, produkty):\n" +
        "- ...\n\n" +
        "Kontrola jakości i bezpieczeństwo naturalnych rzęs:\n" +
        "- ...\n\n" +
        "Zasady:\n" +
        "- Nie pisz o przedłużaniu – mów o liftingu/laminacji.\n" +
        "- Oceń stopień podkręcenia, równomierność ułożenia, ewentualne przegięcia lub zagięcia.\n" +
        "- Zwróć uwagę na kondycję włosa po zabiegu.\n\n" +
        lengthHintPL;
    } else {
      // extensions
      systemPrompt =
        "Jesteś instruktorem stylizacji rzęs i ekspertem analizy zdjęć. " +
        "Analizujesz RZĘSY PO APLIKACJI PRZEDŁUŻANYCH (stylizację). " +
        "Przygotuj raport jakości pracy stylistki.\n\n" +
        "Odpowiedź po polsku, w tej strukturze (zachowaj dokładnie te nagłówki):\n" +
        "Mocne strony stylizacji:\n" +
        "- ...\n\n" +
        "Elementy do poprawy:\n" +
        "- ...\n\n" +
        "Rekomendacje techniczne:\n" +
        "- ...\n\n" +
        "Kontrola jakości i bezpieczeństwo:\n" +
        "- ...\n\n" +
        "Zasady:\n" +
        "- Wyraźnie mów o aplikacji (przedłużanych rzęsach).\n" +
        "- Oceń gęstość, mapowanie długości, kierunek, sklejenia, dobór długości do natury.\n" +
        "- Zawsze uwzględnij bezpieczeństwo naturalnych rzęs.\n\n" +
        lengthHintPL;
    }
  } else {
    // ENGLISH
    if (lashesType === "natural") {
      systemPrompt =
        "You are a lash educator and image analysis expert. " +
        "You are analysing NATURAL LASHES (no extensions, no lift/lamination). " +
        "Prepare a pre-application report.\n\n" +
        "Answer in English using this structure (keep these exact headings):\n" +
        "Strengths of the natural lashes:\n" +
        "- ...\n\n" +
        "Areas for improvement:\n" +
        "- ...\n\n" +
        "Technical recommendations (extensions / lift):\n" +
        "- ...\n\n" +
        "Quality & safety control:\n" +
        "- ...\n\n" +
        "Rules:\n" +
        "- Do NOT say that extensions are already applied.\n" +
        "- Comment on density, growth direction, condition, thinning.\n" +
        "- Suggest safe lengths, thicknesses and curls.\n\n" +
        lengthHintEN;
    } else if (lashesType === "lift") {
      systemPrompt =
        "You are a lash educator and image analysis expert. " +
        "You are analysing a LASH LIFT / lash lamination result (no extensions). " +
        "Prepare a quality report of the treatment.\n\n" +
        "Answer in English using this structure (keep these exact headings):\n" +
        "Strengths of the lash lift:\n" +
        "- ...\n\n" +
        "Areas for improvement:\n" +
        "- ...\n\n" +
        "Technical recommendations (timing, shields, products):\n" +
        "- ...\n\n" +
        "Quality & safety of the natural lashes:\n" +
        "- ...\n\n" +
        "Rules:\n" +
        "- Do not talk about extensions – focus on lift/lamination.\n" +
        "- Evaluate curl, uniformity, any kinks or overprocessing.\n" +
        "- Comment on lash condition after the treatment.\n\n" +
        lengthHintEN;
    } else {
      // extensions
      systemPrompt =
        "You are a lash educator and image analysis expert. " +
        "You are analysing LASH EXTENSIONS (a finished set). " +
        "Prepare a styling quality report.\n\n" +
        "Answer in English using this structure (keep these exact headings):\n" +
        "Strengths of the styling:\n" +
        "- ...\n\n" +
        "Areas for improvement:\n" +
        "- ...\n\n" +
        "Technical recommendations:\n" +
        "- ...\n\n" +
        "Quality & safety control:\n" +
        "- ...\n\n" +
        "Rules:\n" +
        "- Clearly talk about lash extensions, not bare lashes.\n" +
        "- Comment on density, mapping, direction, stickies, length-to-natural ratio.\n" +
        "- Always include a note on natural lash safety.\n\n" +
        lengthHintEN;
    }
  }

  const userPrompt = isPL
    ? "Przeanalizuj zdjęcie i przygotuj raport dokładnie według tej struktury i wytycznych długości."
    : "Analyse the photo and prepare the report exactly using this structure and length guidelines.";

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
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
 *    language: "pl" | "en"
 *    reportMode: "standard" | "detailed" | "pro"
 */
async function analyzeEye(imageBase64, language, reportMode = "standard") {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return {
      status: "error",
      message: "Brak poprawnego obrazu w polu imageBase64."
    };
  }

  const lang = language === "en" ? "en" : "pl";
  const mode =
    reportMode === "detailed" || reportMode === "pro"
      ? reportMode
      : "standard";

  // 1: klasyfikacja
  const lashesType = await classifyLashesType(imageBase64);

  // 2: raport
  const reportText = await generateLashReport(
    imageBase64,
    lang,
    lashesType,
    mode
  );

  return {
    status: "success",
    type: lashesType,      // "natural", "extensions", "lift"
    mode,                  // "standard" | "detailed" | "pro"
    result: reportText
  };
}

module.exports = { analyzeEye };
