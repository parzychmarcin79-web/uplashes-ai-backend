const express = require("express");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint testowy
app.get("/", (req, res) => {
  res.send("UPLashes AI Backend działa poprawnie 💎");
});

// Port z Render
const port = process.env.PORT || 10000;

app.listen(port, () => {
  console.log(`UPLashes backend działa na porcie ${port}`);
});
