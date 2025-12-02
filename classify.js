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
 *    overrideType – jeśli ustawione, omijamy klasyfikację i zwracamy to, co wymusiła stylistka
 */
async function classifyLashesType(imageBase64, overrideType = null) {
  // Jeśli stylistka ręcznie wybrała typ – nie pytamy modelu, tylko zwracamy to
  if (
    overrideType === "natural" ||
    overrideType === "extensions" ||
    overrideType === "lift"
  ) {
    return overrideType;
  }

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
async function generateLashReport(
  imageBase64,
  language,
  lashesType,
  reportMode = "standard"
) {
  const dataUrl = toDataUrl(imageBase64);
  const isPL = language !== "en";

  // Podpowiedź długości – używana w STANDARD / DETAILED,
  // dla PRO mamy osobny, mocniejszy prompt.
  let lengthHintPL;
  let lengthHintEN;

  if (reportMode === "detailed") {
    lengthHintPL =
      "Raport ma być SZCZEGÓŁOWY. W każdej sekcji wypisz 4–6 punktów, większość punktów może mieć 1–2 zdania.";
    lengthHintEN =
      "Make the report DETAILED. For each section write 4–6 bullet points, most of them 1–2 sentences.";
  } else if (reportMode === "standard") {
    lengthHintPL =
      "Raport ma być ZWIĘZŁY, ale merytoryczny. W każdej sekcji wypisz 2–4 krótkie punkty (po jednym zdaniu).";
    lengthHintEN =
      "Keep the report CONCISE but informative. For each section write 2–4 short bullet points (one sentence each).";
  }

  let systemPrompt;

  if (isPL) {
    // ======================= POLSKI =======================

    if (lashesType === "natural") {
      if (reportMode === "pro") {
        // PRO – NATURALNE RZĘSY
        systemPrompt =
          "Jesteś profesjonalnym instruktorem stylizacji rzęs i ekspertem analizy zdjęć. " +
          "Analizujesz NATURALNE RZĘSY (bez aplikacji przedłużanych i bez liftingu/laminacji). " +
          "Twoim zadaniem jest przygotowanie zaawansowanego raportu 'przed aplikacją', który wygląda jak feedback po szkoleniu PRO.\n\n" +
          "Stwórz raport według następującej struktury (zachowaj dokładnie nagłówki):\n\n" +
          "Mocne strony naturalnych rzęs:\n" +
          "- wypisz 5–8 punktów, w każdym 1–2 zdania.\n" +
          "- oceń: gęstość, grubość, kierunek wzrostu, stan linii wodnej, kondycję powieki.\n\n" +
          "Elementy do poprawy:\n" +
          "- wypisz 5–8 punktów z konkretnymi uwagami.\n" +
          "- uwzględnij: przerzedzenia, różnice w kierunku wzrostu, łamanie włosków, suchą/skłonną do przetłuszczania skórę.\n\n" +
          "Analiza szczegółowa według stref oka:\n" +
          "- Wewnętrzny kącik: opisz gęstość, kierunek, wrażliwość.\n" +
          "- Strefa centralna: opisz główny kierunek wzrostu, potencjał do liftingu/przedłużania.\n" +
          "- Zewnętrzny kącik: oceń długość, gęstość, ryzyko opadania kącika.\n\n" +
          "Rekomendacje techniczne – przedłużanie / lifting:\n" +
          "- zaproponuj konkretne zakresy długości (np. 7–10 mm), grubości (np. 0.07), skręty (np. C, CC), rodzaje map (np. dolly, natural, squirrel).\n" +
          "- wypisz 4–7 zaleceń, językiem trenerskim.\n\n" +
          "Kontrola jakości i bezpieczeństwo:\n" +
          "- oceń, na ile naturalne rzęsy są przygotowane do stylizacji (obciążenie, elastyczność, przerzedzenia).\n" +
          "- wypisz 4–6 punktów, jak pracować, aby nie przeciążyć naturalnych rzęs.\n\n" +
          "Długość: minimum 18 linijek, idealnie 22–30 linijek treści. Raport ma wyglądać jak profesjonalna analiza na poziomie PRO.";
      } else {
        // STANDARD / DETAILED – NATURAL
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
          (lengthHintPL || "");
      }
    } else if (lashesType === "lift") {
      if (reportMode === "pro") {
        // PRO – LASH LIFT
        systemPrompt =
          "Jesteś profesjonalnym instruktorem stylizacji rzęs i ekspertem zabiegów lash lift / laminacji. " +
          "Analizujesz efekt LASH LIFT na zdjęciu. Twoim zadaniem jest przygotowanie raportu na poziomie PRO, jak na szkoleniu dla zaawansowanych stylistek.\n\n" +
          "Stwórz raport według struktury (zachowaj dokładnie nagłówki):\n\n" +
          "Mocne strony zabiegu lash lift:\n" +
          "- wypisz 5–8 punktów (1–2 zdania każdy), oceniając: równomierność podkręcenia, zachowanie ciągłości linii, dobór wałeczka, intensywność efektu.\n\n" +
          "Elementy do poprawy:\n" +
          "- wypisz 5–8 technicznych uwag: ewentualne przegięcia, zagięcia, różnice w uniesieniu, niedokręcenia, nadmierne uniesienie.\n\n" +
          "Analiza szczegółowa według stref oka:\n" +
          "- Wewnętrzny kącik: stopień uniesienia, czy rzęsy nie są przygniecione do powieki.\n" +
          "- Strefa centralna: symetria łuku, równomierność skrętu.\n" +
          "- Zewnętrzny kącik: ryzyko \"opadającego\" kącika lub przeprostowania.\n\n" +
          "Rekomendacje techniczne (czas, dobór wałeczków, produkty):\n" +
          "- zaproponuj korekty czasu trzymania, możliwą zmianę rozmiaru wałeczka, sposób rozkładania preparatu.\n" +
          "- wypisz 4–7 zaleceń, jak poprawić efekt przy kolejnym zabiegu.\n\n" +
          "Kontrola jakości i bezpieczeństwo naturalnych rzęs:\n" +
          "- oceń, czy nie ma oznak przeproteinowania, nadmiernego przesuszenia, osłabienia struktury.\n" +
          "- wypisz 4–6 punktów dotyczących dalszej pielęgnacji i bezpiecznej częstotliwości zabiegów.\n\n" +
          "Długość: minimum 18 linijek, idealnie 22–30 linijek treści. Raport ma wyglądać jak feedback po szkoleniu PRO.";
      } else {
        // STANDARD / DETAILED – LIFT
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
          (lengthHintPL || "");
      }
    } else {
      // EXTENSIONS
      if (reportMode === "pro") {
        // PRO – STYLIZACJA PRZEDŁUŻANYCH
        systemPrompt =
          "Jesteś profesjonalnym instruktorem stylizacji rzęs i ekspertem analizy zdjęć, pracującym na poziomie PRO. " +
          "Analizujesz aplikację PRZEDŁUŻANYCH RZĘS (stylizacja). Twoim zadaniem jest przygotowanie zaawansowanego raportu technicznego jakości pracy stylistki. " +
          "Raport ma być rozbudowany, edukacyjny i brzmieć jak feedback po szkoleniu mistrzowskim.\n\n" +
          "Stwórz raport według następującej struktury (zachowaj dokładnie nagłówki):\n\n" +
          "Mocne strony stylizacji:\n" +
          "- wypisz 5–8 punktów, w każdym 1–2 zdania.\n" +
          "- oceń: separację, kierunki rzęs, dobór skrętu, czystość pracy, logiczne mapowanie, dobór długości do natury.\n\n" +
          "Elementy do poprawy:\n" +
          "- wypisz 5–8 punktów z technicznymi uwagami.\n" +
          "- uwzględnij: nieregularne kierunki, drobne sklejenia, różnice w gęstości, braki w mapowaniu, brak płynnego przejścia długości.\n\n" +
          "Analiza szczegółowa według stref oka:\n" +
          "- Wewnętrzny kącik: opisz gęstość, kierunek, subtelność długości.\n" +
          "- Strefa centralna: opisz budowę głównego łuku, równomierność linii i kontrolę skrętu.\n" +
          "- Zewnętrzny kącik: oceń lifting kącika, ryzyko jego \"opadania\", spójność z resztą mapy.\n\n" +
          "Rekomendacje techniczne – poziom PRO:\n" +
          "- zaproponuj konkretne zakresy długości (np. 7–11 mm), grubości (np. 0.07), skręty (C, CC, D) oraz typ mapy (np. natural, dolly, squirrel).\n" +
          "- wypisz 4–7 szczegółowych zaleceń: zmiana długości w konkretnych strefach, korekta kątów przyklejenia, praca nad \"stickies\".\n\n" +
          "Kontrola jakości i bezpieczeństwo:\n" +
          "- oceń obciążenie naturalnych rzęs, dobór grubości, proporcję długości do natury.\n" +
          "- wypisz 4–6 punktów dotyczących bezpieczeństwa, utrzymania kondycji rzęs i kontroli kolejnych uzupełnień.\n\n" +
          "Długość: minimum 18 linijek, idealnie 22–30 linijek treści. " +
          "Raport ma wyglądać jak komentarz instruktora na szkoleniu PRO.";
      } else {
        // STANDARD / DETAILED – EXTENSIONS
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
          (lengthHintPL || "");
      }
    }
  } else {
    // ======================= ENGLISH =======================

    if (lashesType === "natural") {
      if (reportMode === "pro") {
        systemPrompt =
          "You are a professional lash educator and image analysis expert. " +
          "You are analysing NATURAL LASHES (no extensions, no lift/lamination). " +
          "Your task is to create a PRO-level pre-application report that looks like trainer feedback after an advanced class.\n\n" +
          "Use this structure (keep the exact headings):\n\n" +
          "Strengths of the natural lashes:\n" +
          "- provide 5–8 bullet points, 1–2 sentences each.\n" +
          "- comment on density, thickness, growth direction, lid condition and potential.\n\n" +
          "Areas for improvement:\n" +
          "- provide 5–8 technical points.\n" +
          "- include thinning zones, inconsistent directions, breakage, dryness or oiliness.\n\n" +
          "Zone-based analysis:\n" +
          "- Inner corner: density, direction, sensitivity.\n" +
          "- Mid-zone: main growth pattern, potential for lift/extensions.\n" +
          "- Outer corner: length, density, droop risk.\n\n" +
          "Technical recommendations (extensions / lift):\n" +
          "- suggest concrete ranges for lengths (e.g. 7–10 mm), thicknesses (e.g. 0.07), curls (C, CC) and mapping types (natural, dolly, squirrel).\n" +
          "- list 4–7 trainer-level recommendations.\n\n" +
          "Quality & safety control:\n" +
          "- assess how ready the natural lashes are for styling (load tolerance, elasticity, thinning).\n" +
          "- list 4–6 safety-focused points.\n\n" +
          "Length: at least 18 lines, ideally 22–30 lines. It must read like a PRO-level analysis.";
      } else {
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
          (lengthHintEN || "");
      }
    } else if (lashesType === "lift") {
      if (reportMode === "pro") {
        systemPrompt =
          "You are a professional lash lift educator and image analysis expert. " +
          "You are analysing a LASH LIFT / lash lamination result. " +
          "Your task is to produce a PRO-level report similar to trainer feedback during a masterclass.\n\n" +
          "Use this structure (keep the exact headings):\n\n" +
          "Strengths of the lash lift:\n" +
          "- provide 5–8 bullet points assessing curl consistency, shield choice, smoothness and overall effect.\n\n" +
          "Areas for improvement:\n" +
          "- provide 5–8 technical points: kinks, overprocessed areas, under-lifted sections, uneven curl.\n\n" +
          "Zone-based analysis:\n" +
          "- Inner corner: lift, cleanliness, no lashes stuck to the lid.\n" +
          "- Mid-zone: symmetry and curl balance.\n" +
          "- Outer corner: lift vs droop risk, overprocessing risk.\n\n" +
          "Technical recommendations (timing, shields, products):\n" +
          "- suggest changes to processing time, shield size, product placement and technique.\n" +
          "- list 4–7 detailed recommendations.\n\n" +
          "Quality & safety of the natural lashes:\n" +
          "- assess signs of overprocessing, dryness, weakening.\n" +
          "- list 4–6 safety and aftercare tips.\n\n" +
          "Length: at least 18 lines, ideally 22–30 lines. It must read like PRO-level feedback.";
      } else {
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
          (lengthHintEN || "");
      }
    } else {
      // EXTENSIONS
      if (reportMode === "pro") {
        systemPrompt =
          "You are a professional lash educator and advanced stylist trainer. " +
          "You are analysing a LASH EXTENSIONS set. Your task is to produce a PRO-level technical report, similar to feedback given during an advanced masterclass.\n\n" +
          "Use this structure (keep the exact headings):\n\n" +
          "Strengths of the styling:\n" +
          "- provide 5–8 bullet points, 1–2 sentences each.\n" +
          "- highlight: separation, direction, curl choice, mapping logic, weight management.\n\n" +
          "Areas for improvement:\n" +
          "- provide 5–8 technical points.\n" +
          "- include: inconsistent directions, minor stickies, uneven density, mapping gaps, harsh transitions in length.\n\n" +
          "Detailed zone-based analysis:\n" +
          "- Inner corner: direction, density, subtlety of lengths.\n" +
          "- Mid-zone: main lash line shape, symmetry, curl balance.\n" +
          "- Outer corner: lift vs droop risk, length choice, continuity.\n\n" +
          "Technical recommendations – PRO level:\n" +
          "- suggest concrete adjustments: lengths (e.g. 7–11 mm), thicknesses (e.g. 0.07), curls (C, CC, D), mapping (natural, dolly, squirrel).\n" +
          "- list 4–7 detailed recommendations: zone-specific length changes, attachment angles, isolation and stickies control.\n\n" +
          "Quality & safety control:\n" +
          "- assess natural lash load, thickness choice, length-to-natural ratio.\n" +
          "- list 4–6 safety-focused points for future infills.\n\n" +
          "Length: at least 18 lines, ideally 22–30 lines. It must read like trainer-level feedback.";
      } else {
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
          (lengthHintEN || "");
      }
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
 *    overrideType: "natural" | "extensions" | "lift" | null
 */
async function analyzeEye(
  imageBase64,
  language,
  reportMode = "standard",
  overrideType = null
) {
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

  const override =
    overrideType === "natural" ||
    overrideType === "extensions" ||
    overrideType === "lift"
      ? overrideType
      : null;

  // 1: klasyfikacja (lub wymuszenie typu)
  const lashesType = await classifyLashesType(imageBase64, override);

  // 2: raport
  const reportText = await generateLashReport(
    imageBase64,
    lang,
    lashesType,
    mode
  );

  return {
    status: "success",
    type: lashesType, // "natural", "extensions", "lift"
    mode,
    result: reportText
  };
}

module.exports = { analyzeEye };
