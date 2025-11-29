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
