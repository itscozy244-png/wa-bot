const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('COZY BOT RUNNING - Go to /pair?number=254... or /reset to clear sessions'));
app.listen(PORT, () => console.log('Server running on', PORT));

let sock;
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
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
    if (!text) return;
    const cmd = text.trim().split(/ +/)[0].toLowerCase();

    if (cmd === '.menu' || cmd === '.help') {
      await sock.sendMessage(from, { image: { url: BOT_IMAGE }, caption: `*ITS COZY BOT MENU*\n\n.menu - this menu\n.ping - speed\n.alive - check alive\n.owner - owner\n.jid - get jid\n.tagall - tag all (group)\n\nBot by itscozy244` });
    }
    if (cmd === '.ping') {
      await sock.sendMessage(from, { text: 'Pong! ⚡ Fast' });
    }
    if (cmd === '.alive') {
      await sock.sendMessage(from, { image: { url: BOT_IMAGE }, caption: '*COZY BOT ALIVE* ✅\nOnline 24/7' });
    }
    if (cmd === '.owner') {
      await sock.sendMessage(from, { text: 'Owner: wa.me/254142718291' });
    }
    if (cmd === '.jid') {
      await sock.sendMessage(from, { text: `JID: ${from}` });
    }
    if (cmd === '.tagall' && from.endsWith('@g.us')) {
      const meta = await sock.groupMetadata(from);
      const participants = meta.participants.map(p => p.id);
      await sock.sendMessage(from, { text: `Tagging ${participants.length} members`, mentions: participants });
    }
  });
}

app.get('/reset', (req, res) => {
  try {
    if (fs.existsSync('sessions')) {
      fs.rmSync('sessions', { recursive: true, force: true });
    }
    res.send('Sessions DELETED! Now go to Render > Manual Deploy > Clear build cache & deploy, then pair again.');
  } catch (e) {
    res.send('Error deleting: ' + e.message);
  }
});

app.get('/pair', async (req, res) => {
  const num = req.query.number;
  if (!num) return res.send('Add ?number=254... in URL');
  try {
    if (!sock) return res.send('Bot not started yet, wait 20 sec and refresh');
    const code = await sock.requestPairingCode(num.trim());
    res.send(`<h1 style="font-size:50px;text-align:center">CODE: ${code}</h1><p style="text-align:center">For ${num}<br>Go WhatsApp > Linked Devices > Link with phone number > Enter FAST<br>Expires in 60 sec</p>`);
  } catch (e) {
    console.log(e);
    res.send('Error: ' + e.message + ' | If already linked, bot is already connected!');
  }
});

startBot();
