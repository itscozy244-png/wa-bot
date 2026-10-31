const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('<h2>COZY BOT RUNNING</h2><p><a href="/pair?number=254142718291">GET PAIR CODE</a></p><p><a href="/reset">RESET SESSIONS</a></p>'));
app.listen(PORT, () => console.log('Server running', PORT));

let sock;
let lastCode = null;
let lastCodeTime = 0;
const BOT_IMAGE = 'https://i.ibb.co/5XqHJ3Q7/IMG-20240520-WA0002.jpg';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('sessions');
  sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
    logger: pino({ level: 'silent' }),
    browser: ["Cozy Bot", "Chrome", "1.0"]
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('Bot connected!');
      lastCode = null;
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
    if (!text) return;
    const cmd = text.trim().split(/ +/)[0].toLowerCase();
    if (cmd === '.menu') {
      await sock.sendMessage(from, { image: { url: BOT_IMAGE }, caption: `*ITS COZY BOT MENU*\n\n.menu - this menu\n.ping - speed\n.alive - check alive\n.owner - owner\n.jid - get jid\n\nBot by itscozy244` });
    }
    if (cmd === '.ping') await sock.sendMessage(from, { text: 'Pong! ⚡ Fast' });
    if (cmd === '.alive') await sock.sendMessage(from, { image: { url: BOT_IMAGE }, caption: '*COZY BOT ALIVE* ✅\nOnline 24/7' });
    if (cmd === '.owner') await sock.sendMessage(from, { text: 'Owner: wa.me/254142718291' });
    if (cmd === '.jid') await sock.sendMessage(from, { text: `JID: ${from}` });
  });
}

app.get('/reset', (req, res) => {
  try {
    if (fs.existsSync('sessions')) fs.rmSync('sessions', { recursive: true, force: true });
    lastCode = null;
    res.send('Sessions DELETED! Now go Render > Manual Deploy > Clear build cache & deploy, then /pair');
  } catch (e) { res.send('Error: ' + e.message); }
});

app.get('/pair', async (req, res) => {
  const num = req.query.number;
  if (!num) return res.send('Add ?number=254... in URL - example /pair?number=254142718291');
  try {
    if (!sock) return res.send('Bot not started yet, wait 15 sec and refresh');
    if (lastCode && Date.now() - lastCodeTime < 90000 && !req.query.force) {
      return res.send(`<h1 style="font-size:50px;text-align:center">CODE: ${lastCode}</h1><p style="text-align:center">Same code (valid 90 sec)<br>For ${num}<br>WhatsApp > Linked Devices > Link with phone number</p><p style="text-align:center"><a href="/pair?number=${num}&force=1">Get NEW code</a></p>`);
    }
    const code = await sock.requestPairingCode(num.trim());
    lastCode = code;
    lastCodeTime = Date.now();
    res.send(`<h1 style="font-size:50px;text-align:center">CODE: ${code}</h1><p style="text-align:center">For ${num}<br>WhatsApp > Linked Devices > Link a device > Link with phone number instead<br>Type it - valid 90 seconds!</p>`);
  } catch (e) {
    res.send('Error: ' + e.message + ' | If bot already connected, test .menu');
  }
});

startBot();
