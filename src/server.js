const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is Running! Keep this tab open after pairing'));
app.listen(PORT, () => console.log('Server running on', PORT));

let sock;

async function startBot() {
  if (fs.existsSync('sessions') && fs.readdirSync('sessions').length === 0) {
    fs.rmSync('sessions', { recursive: true, force: true });
  }
  const { state, saveCreds } = await useMultiFileAuthState('sessions');
  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
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
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!text) return;
    if (text.startsWith('.menu')) {
      await sock.sendMessage(from, { text: `*ITS COZY BOT*\n\n.menu - this menu\n.ping - check speed\n.alive - bot alive\n.jid - get group jid` });
    }
    if (text.startsWith('.ping')) {
      await sock.sendMessage(from, { text: 'Pong! Speed: fast ⚡' });
    }
    if (text.startsWith('.alive')) {
      await sock.sendMessage(from, { text: 'Yes I am alive ✅ wa-bot by itscozy244' });
    }
  });
}

app.get('/pair', async (req, res) => {
  const num = req.query.number;
  if (!num) return res.send('Add ?number=2547... in URL');
  try {
    if (!sock) return res.send('Bot not started yet, wait 20 sec and refresh');
    if (!fs.existsSync('sessions/creds.json')) {
       // need to request code quickly after start
    }
    const code = await sock.requestPairingCode(num.trim());
    res.send(`<h1 style="font-size:50px">Code: ${code}</h1><p>For: ${num}</p><p>Go to WhatsApp > Linked devices > Link with phone number</p><p>Code expires in 60 seconds, refresh for new code</p>`);
  } catch (e) {
    console.log(e);
    res.send('Error: ' + e.message + ' - Try refresh after 10 sec');
  }
});

startBot();
