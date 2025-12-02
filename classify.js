// classify.js – klasyfikacja rzęs i generowanie raportu
// Typy:
//  - "natural"    – naturalne rzęsy, bez aplikacji i bez lash lift
//  - "extensions" – rzęsy po przedłużaniu
//  - "lift"       – lash lift / laminacja

const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Zamiana base64 na data URL
 */
function toDataUrl(imageBase64) {
  return `data:image/png;base64,${imageBase64}`;
}

/**
 * 1. Klasyfikacja typu rzęs:
 *    natural / extensions / lift
 */
async function classifyLashesType(imageBase64) {
  const dataUrl = toDataUrl(imageBase64);

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    text_format: "plain",
    input: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
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
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: { url: dataUrl }
          },
          {
            type: "text",
            text: "Classify this eye photo."
          }
        ]
      }
    ],
    max_output_tokens: 5
  });

  let raw = "";
  try {
    raw = (response.output?.[0]?.content?.[0]?.text || "").trim().toLowerCase();
  } catch (err) {
    console.error("Error reading classification response:", err);
  }

  if (raw.includes("extension")) return "extensions";
  if (raw.includes("lift")) return "lift";
  if (raw.includes("natural")) return "natural";

  // Bezpieczny fallback – większość zdjęć w produkcji to stylizacje
  return "extensions";
}

/**
 * 2. Generowanie raportu na podstawie typu rzęs + języka
 */
async function generateLashReport(imageBase64, language, lashesType) {
  const dataUrl = toDataUrl(imageBase64);
  const isPL = language !== "en";

  let systemPrompt;

  if (isPL) {
    if (lashesType === "natural") {
      systemPrompt =
        "Jesteś instruktorem stylizacji rzęs i ekspertem analizy zdjęć. " +
        "Analizujesz NATURALNE RZĘSY (bez aplikacji przedłużanych i bez liftingu/laminacji). " +
        "Przygotuj raport 'przed aplikacją'.\n\n" +
        "Odpowiedź po polsku, w tej strukturze:\n" +
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
        "- W rekomendacjach sugeruj bezpieczne długości, grubości i skręty.";
    } else if (lashesType === "lift") {
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
        "Zasady:\n" +
        "- Nie pisz o przedłużaniu – mów o liftingu/laminacji.\n" +
        "- Oceń stopień podkręcenia, równomierność ułożenia, ewentualne przegięcia lub zagięcia.\n" +
        "- Zwróć uwagę na kondycję włosa po zabiegu.";
    } else {
      // extensions
      systemPrompt =
        "Jesteś instruktorem stylizacji rzęs i ekspertem analizy zdjęć. " +
        "Analizujesz RZĘSY PO APLIKACJI PRZEDŁUŻANYCH (stylizację). " +
        "Przygotuj raport jakości pracy stylistki.\n\n" +
        "Odpowiedź po polsku, w tej strukturze:\n" +
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
        "- Zawsze uwzględnij bezpieczeństwo naturalnych rzęs.";
    }
  } else {
    // ENGLISH
    if (lashesType === "natural") {
      systemPrompt =
        "You are a lash educator and image analysis expert. " +
        "You are analysing NATURAL LASHES (no extensions, no lift/lamination). " +
        "Prepare a pre-application report.\n\n" +
        "Answer in English using this structure:\n" +
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
        "- Suggest safe lengths, thicknesses and curls.";
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
        "Rules:\n" +
        "- Do not talk about extensions – focus on lift/lamination.\n" +
        "- Evaluate curl, uniformity, any kinks or overprocessing.\n" +
        "- Comment on lash condition after the treatment.";
    } else {
      // extensions
      systemPrompt =
        "You are a lash educator and image analysis expert. " +
        "You are analysing LASH EXTENSIONS (a finished set). " +
        "Prepare a styling quality report.\n\n" +
        "Answer in English using this structure:\n" +
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
        "- Always include a note on natural lash safety.";
    }
  }

  const userPrompt = isPL
    ? "Przeanalizuj zdjęcie i przygotuj raport dokładnie według tej struktury."
    : "Analyse the photo and prepare the report exactly using this structure.";

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    text_format: "plain",
    input: [
      {
        role: "system",
        content: [{ type: "text", text: systemPrompt }]
      },
      {
        role: "user",
        content: [
          { type: "input_image", image_url: { url: dataUrl } },
          { type: "text", text: userPrompt }
        ]
      }
    ]
  });

  const text = (response.output?.[0]?.content?.[0]?.text || "").trim();
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
