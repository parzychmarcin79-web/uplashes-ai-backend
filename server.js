const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "lash-map-test",
    message: "UPLashes AI – testowy backend mapy rzęs działa."
  });
});

app.get("/status", (req, res) => {
  res.status(200).json({
    status: "live",
    module: "lash-map-test",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

app.post("/lash-map", (req, res) => {
  res.status(200).json({
    status: "success",
    module: "lash-map-test",
    example: true
  });
});

app.listen(PORT, () => {
  console.log(`UPLashes AI backend działa na porcie ${PORT}`);
});
const API_URL = "https://uplashes-ai-backend.onrender.com/lash-map";

async function generateLashMap(formData) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eyeType: formData.eyeType || "standard",
      style: formData.style || "natural-open-eye",
      curl: formData.curl || "C",
      thickness: formData.thickness || "0.10",
      note: formData.note || "",
      customSections: formData.customSections || null,
    }),
  });

  const data = await response.json();
  console.log("Mapa z backendu:", data);
  // tutaj rysujesz mapę na ekranie z data.sections
}

