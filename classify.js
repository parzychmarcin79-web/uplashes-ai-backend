const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * 1. KLASYFIKACJA: naturalne rzęsy vs rzęsy po aplikacji
 */
async function classifyLashes(imageBase64) {
  const dataUrl = `data:image/png;base64,${imageBase64}`;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
              "You are an expert lash stylist and image analyst. " +
              "Your ONLY task is to classify the lashes in the image.\n\n" +
              "Return STRICT JSON {\"type\":\"natural\"} or {\"type\":\"extensions\"}.\n\n" +
              "Definitions:\n" +
              "- natural: no lash extensions applied, irregular length/direction, no bonding points.\n" +
              "- extensions: visible added lashes, stronger density, uniform curl, bonding points.\n" +
              "If unsure, choose the most likely option. DO NOT add explanations."
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
            text: "Classify this eye."
          }
        ]
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "lashes_type_schema",
        schema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["natural", "extensions"]
            }
          },
          required: ["type"],
          additionalProperties: false
        },
        strict: true
      }
    }
  });

  try {
    return JSON.parse(response.output[0].content[0].text).type;
  } catch (err) {
    return "extensions"; // default fallback
  }
}

/**
 * 2. RAPORT: generowanie raportu na podstawie typu rzęs
 */
async function generateReport(imageBase64, language, lashesType) {
  const dataUrl = `data:image/png;base64,${imageBase64}`;
  const isPL = language !== "en";

  const systemTextPL =
    lashesType === "natural"
      ? "Analizujesz NATURALNE rzęsy. Przygotuj raport 'przed aplikacją'. Struktura: Mocne strony naturalnych rzęs, Elementy do poprawy, Rekomendacje techniczne, Kontrola jakości i bezpieczeństwo."
      : "Analizujesz rzęsy PO APLIKACJI. Przygotuj raport stylizacji. Struktura: Mocne strony stylizacji, Elementy do poprawy, Rekomendacje techniczne, Kontrola jakości i bezpieczeństwo.";

  const systemTextEN =
    lashesType === "natural"
      ? "You analyse NATURAL lashes. Prepare a pre-application report. Structure: Strengths, Areas for improvement, Technical recommendations, Quality & safety."
      : "You analyse LASH EXTENSIONS. Prepare a styling report. Structure: Strengths, Areas for improvement, Technical recommendations, Quality & safety.";

  const systemPrompt = isPL ? systemTextPL : systemTextEN;

  const userPrompt = isPL
    ? "Przygotuj kompletny raport."
    : "Prepare the full report.";

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
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

  return response.output[0].content[0].text.trim();
}

/**
 * 3. GŁÓWNA FUNKCJA
 */
async function analyzeEye(imageBase64, language) {
  // Krok 1: klasyfikacja
  const lashesType = await classifyLashes(imageBase64);

  // Krok 2: raport
  const result = await generateReport(imageBase64, language, lashesType);

  return {
    status: "success",
    type: lashesType, // "natural" lub "extensions"
    result
  };
}

module.exports = { analyzeEye };
