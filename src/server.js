const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('<h2>COZY BOT</h2><a href="/pair?number=254142718291">PAIR</a> | <a href="/reset">RESET</a>'));
app.listen(PORT, () => console.log('Running', PORT));

let sock;
let pairingSock = null;
let lastCode = null;
let lastCodeTime = 0;
const BOT_IMAGE = 'https://i.ibb.co/5XqHJ3Q7/IMG-20240520-WA0002.jpg';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('sessions');
  sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
    logger: pino({ level: 'silent' }),
    browser: ["Ubuntu", "Chrome", "20.0.04"]
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('BOT CONNECTED!');
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
      await sock.sendMessage(from, { image: { url: BOT_IMAGE }, caption: `*COZY BOT MENU*\n\n.menu\n.ping\n.alive\n.owner` });
    }
    if (cmd === '.ping') await sock.sendMessage(from, { text: 'Pong! ⚡' });
    if (cmd === '.alive') await sock.sendMessage(from, { text: '*ALIVE* ✅' });
  });
}

app.get('/reset', (req, res) => {
  try {
    if (fs.existsSync('sessions')) fs.rmSync('sessions', { recursive: true, force: true });
    lastCode = null;
    pairingSock = null;
    res.send('DELETED! Now Render > Manual Deploy > Clear cache & deploy, then pair again');
  } catch (e) { res.send(e.message); }
});

app.get('/pair', async (req, res) => {
  const num = req.query.number?.replace(/[^0-9]/g, '');
  if (!num) return res.send('Add ?number=254142718291');
  try {
    if (sock && sock.authState.creds.registered) {
      return res.send('Bot ALREADY PAIRED! Test .menu on WhatsApp. If not working go /reset then pair again');
    }
    if (lastCode && Date.now() - lastCodeTime < 120000 && !req.query.force) {
      return res.send(`<h1 style="font-size:50px;text-align:center">CODE: ${lastCode}</h1><p style="text-align:center">For ${num}<br>Same code - valid 2 min<br>WhatsApp > Linked Devices > Link with phone number<br><br><a href="/pair?number=${num}&force=1">Get NEW code</a></p>`);
    }
    // Create fresh pairing socket like Jawad-MD does
    const { state, saveCreds } = await useMultiFileAuthState('sessions');
    pairingSock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
      logger: pino({ level: 'silent' }),
      browser: ["Ubuntu", "Chrome", "20.0.04"]
    });
    pairingSock.ev.on('creds.update', saveCreds);
    // Wait 3 sec for socket init
    await new Promise(r => setTimeout(r, 3000));
    const code = await pairingSock.requestPairingCode(num);
    lastCode = code;
    lastCodeTime = Date.now();
    // Copy creds to main bot
    if (sock) { sock.authState.creds = state.creds; }
    res.send(`<h1 style="font-size:50px;text-align:center">CODE: ${code}</h1><p style="text-align:center">For ${num}<br>WhatsApp > Linked Devices > Link a device > Link with phone number instead<br>Valid 2 min - Jawad style<br><br>After entering, wait 10 sec then test .menu</p>`);
  } catch (e) {
    console.log(e);
    res.send('Error: ' + e.message + ' | Try /reset then pair again');
  }
});

startBot();
