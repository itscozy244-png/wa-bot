const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is Running! Keep this tab open after pairing'));
app.listen(PORT, () => console.log('Server running on', PORT));

let sock;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('sessions');
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
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

    if (text.startsWith('.menu')) {
      await sock.sendMessage(from, { text: `*ITS COZY BOT*\n\n.menu - this menu\n.ping - check speed\n.alive - bot alive\n.jid - get group jid\n.pair 2547... - pair other number` });
    }
    if (text.startsWith('.ping')) {
      await sock.sendMessage(from, { text: 'Pong! Speed: fast ⚡' });
    }
    if (text.startsWith('.alive')) {
      await sock.sendMessage(from, { text: 'Yes I am alive ✅ wa-bot by itscozy244' });
    }
    if (text.startsWith('.jid')) {
      await sock.sendMessage(from, { text: `JID: ${from}` });
    }
    if (text.startsWith('.pair ')) {
      const number = text.replace('.pair ', '').trim();
      if (!number) return await sock.sendMessage(from, { text: 'Use: .pair 254712345678' });
      try {
        const code = await sock.requestPairingCode(number);
        await sock.sendMessage(from, { text: `*PAIRING CODE for ${number}:* \n\n${code}\n\nGo to WhatsApp > Linked devices > Link with phone number` });
      } catch (e) {
        await sock.sendMessage(from, { text: 'Failed to get code: ' + e.message });
      }
    }
  });
}

app.get('/pair', async (req, res) => {
  const num = req.query.number;
  if (!num) return res.send('Add ?number=2547... in URL');
  try {
    if (!sock) return res.send('Bot not started yet, wait 10 sec');
    const code = await sock.requestPairingCode(num);
    res.send(`<h1>Your code: ${code}</h1><p>For: ${num}</p><p>WhatsApp > Linked Devices > Link with phone number</p>`);
  } catch (e) {
    res.send('Error: ' + e.message);
  }
});

startBot();
