const express = require('express');
const handler = require('./api/funding.js');
const app = express();

// Ajoute ça AVANT toute route :
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Autorise TOUTES les origines (OK en dev)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/api/funding', handler);

app.listen(4000, () => {
  console.log('Test API funding running on http://localhost:4000/api/funding');
});
