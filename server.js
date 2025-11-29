// UPLashes AI – backend TESTOWY
// Tylko po to, żeby sprawdzić czy Render działa poprawnie.

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Prosty endpoint główny
app.get("/", (req, res) => {
  res.send("UPLashes AI – backend TEST działa ✅");
});

// Endpoint /ping do testów
app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "Ping z testowego backendu UPLashes AI działa.",
  });
});

// Start serwera
app.listen(PORT, () => {
  console.log(`TEST – backend UPLashes AI działa na porcie ${PORT}`);
});
