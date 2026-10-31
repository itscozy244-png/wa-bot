const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('COZY BOT IS ONLINE 24/7 - This is just the laptop');
});

app.listen(PORT, () => {
  console.log('Keep-alive server running on', PORT);
});
