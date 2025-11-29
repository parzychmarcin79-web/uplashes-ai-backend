// UPLashes AI – TESTOWY BACKEND MAPY RZĘS (server.js)
// UWAGA: to jest WERSJA TESTOWA – bez podłączenia do OpenAI.
// Zwraca gotową przykładową mapę, żeby frontend mógł działać bez błędów.

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// Ustawienia podstawowe
app.use(cors()); // zezwalamy na połączenia z dowolnej domeny (na testy jest OK)
app.use(express.json({ limit: "10mb" })); // obsługa JSON, np. base64 zdjęcia itp.

// PORT – Render sam ustawia PORT w zmiennej środowiskowej
const PORT = process.env.PORT || 10000;

/**
 * ROUTE 1 – root (dla Render / health check)
 * Zwraca prostą informację, że serwer działa.
 */
app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "lash-map-test",
    message: "UPLashes AI – testowy backend mapy rzęs działa poprawnie.",
  });
});

/**
 * ROUTE 2 – status (jeśli frontend pyta tylko o status)
 * Możesz podpiąć pod to endpoint we froncie, jeśli potrzeba.
 */
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live", // <<< TUTAJ JEST STATUS "live"
    module: "lash-map-test",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

/**
 * ROUTE 3 – główny endpoint testowy mapy rzęs
 * POST /lash-map
 * Dane wejściowe (opcjonalne):
 *   - eyeType, style, curl, thickness, etc. – możesz wysyłać z frontu, ale nie jest to wymagane.
 *
 * Na razie backend zwraca STAŁĄ przykładową mapę,
 * żebyś mogła spokojnie testować front bez błędów.
 */

app.post("/lash-map", (req, res) => {
  try {
    const {
      eyeType,
      style,
      curl,
      thickness,
      note,
      customSections,
    } = req.body || {};

    // Prosta przykładowa mapa – możesz ją później zmienić pod swoje schematy
    const exampleMap = {
      status: "success",
      module: "lash-map-test",
      baseConfig: {
        eyeType: eyeType || "standard",
        style: style || "natural-open-eye",
        curl: curl || "C",
        thickness: thickness || "0.10",
        note: note || "Mapa przykładowa z backendu testowego.",
      },
      sections: [
        {
          id: "inner",
          label: "Kącik wewnętrzny",
          fromPercent: 0,
          toPercent: 20,
          lengths: [7, 8, 9],
          comment: "Bardzo delikatny start, krótsze długości.",
        },
        {
          id: "transition",
          label: "Strefa przejściowa",
          fromPercent: 20,
          toPercent: 40,
          lengths: [9, 10],
          comment: "Łagodn
