const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data', 'messages.json');
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');

// ─── Storage helpers ───────────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { conversations: {}, contacts: {} };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ─── WhatsApp API helper ───────────────────────────────────────────
async function sendWhatsAppMessage(to, body, config) {
  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.facebook.com',
      path: `/v19.0/${config.phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendTemplateMessage(to, templateName, langCode, components, config) {
  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: templateName, language: { code: langCode }, components }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.facebook.com',
      path: `/v19.0/${config.phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Webhook verification ──────────────────────────────────────────
app.get('/webhook', (req, res) => {
  const config = loadConfig();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (config.verifyToken || 'myverifytoken123')) {
    console.log('✅ Webhook verificato da Meta');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── Webhook incoming messages ─────────────────────────────────────
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    body.entry?.forEach(entry => {
      entry.changes?.forEach(change => {
        const value = change.value;
        if (!value.messages) return;

        const data = loadData();

        value.messages.forEach(msg => {
          const from = msg.from;
          const contact = value.contacts?.find(c => c.wa_id === from);
          const name = contact?.profile?.name || from;

          if (!data.conversations[from]) {
            data.conversations[from] = { name, phone: from, messages: [], unread: 0 };
          }
          if (!data.contacts[from]) {
            data.contacts[from] = { name, phone: from };
          }

          let text = '';
          if (msg.type === 'text') text = msg.text.body;
          else if (msg.type === 'image') text = '[📷 Immagine]';
          else if (msg.type === 'audio') text = '[🎵 Audio]';
          else if (msg.type === 'document') text = '[📄 Documento]';
          else if (msg.type === 'video') text = '[🎥 Video]';
          else text = `[${msg.type}]`;

          data.conversations[from].messages.push({
            id: msg.id,
            text,
            direction: 'in',
            timestamp: parseInt(msg.timestamp) * 1000,
            status: 'received'
          });
          data.conversations[from].unread++;
          data.conversations[from].name = name;
          data.conversations[from].lastMessage = text;
          data.conversations[from].lastTs = parseInt(msg.timestamp) * 1000;

          console.log(`📩 Messaggio da ${name} (${from}): ${text}`);
        });

        // Status updates
        value.statuses?.forEach(status => {
          const data = loadData();
          const conv = data.conversations[status.recipient_id];
          if (conv) {
            conv.messages = conv.messages.map(m =>
              m.id === status.id ? { ...m, status: status.status } : m
            );
          }
          saveData(data);
        });

        saveData(data);
      });
    });
  }

  res.sendStatus(200);
});

// ─── API: config ───────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const cfg = loadConfig();
  // Non esporre il token completo
  res.json({ ...cfg, accessToken: cfg.accessToken ? '••••••••' + cfg.accessToken.slice(-6) : '' });
});

app.post('/api/config', (req, res) => {
  const existing = loadConfig();
  const { phoneNumberId, accessToken, verifyToken, wabaId } = req.body;
  const updated = {
    ...existing,
    phoneNumberId: phoneNumberId || existing.phoneNumberId,
    wabaId: wabaId || existing.wabaId,
    verifyToken: verifyToken || existing.verifyToken || 'myverifytoken123',
    accessToken: (accessToken && !accessToken.includes('••')) ? accessToken : existing.accessToken
  };
  saveConfig(updated);
  res.json({ ok: true });
});

// ─── API: conversations ────────────────────────────────────────────
app.get('/api/conversations', (req, res) => {
  const data = loadData();
  const list = Object.values(data.conversations)
    .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  res.json(list);
});

app.get('/api/conversations/:phone', (req, res) => {
  const data = loadData();
  const conv = data.conversations[req.params.phone];
  if (!conv) return res.status(404).json({ error: 'Non trovato' });
  // Azzera unread
  conv.unread = 0;
  saveData(data);
  res.json(conv);
});

// ─── API: send message ─────────────────────────────────────────────
app.post('/api/send', async (req, res) => {
  const { to, text } = req.body;
  const config = loadConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    return res.status(400).json({ error: 'Credenziali API non configurate' });
  }

  try {
    const result = await sendWhatsAppMessage(to, text, config);
    if (result.error) return res.status(400).json({ error: result.error.message });

    const data = loadData();
    if (!data.conversations[to]) {
      data.conversations[to] = { name: to, phone: to, messages: [], unread: 0 };
    }
    const msg = {
      id: result.messages?.[0]?.id || Date.now().toString(),
      text,
      direction: 'out',
      timestamp: Date.now(),
      status: 'sent'
    };
    data.conversations[to].messages.push(msg);
    data.conversations[to].lastMessage = text;
    data.conversations[to].lastTs = Date.now();
    saveData(data);

    res.json({ ok: true, messageId: msg.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: broadcast ────────────────────────────────────────────────
app.post('/api/broadcast', async (req, res) => {
  const { recipients, text, templateName, langCode, components, useTemplate } = req.body;
  const config = loadConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    return res.status(400).json({ error: 'Credenziali API non configurate' });
  }

  const results = [];
  for (const phone of recipients) {
    try {
      let result;
      if (useTemplate && templateName) {
        result = await sendTemplateMessage(phone, templateName, langCode || 'it', components || [], config);
      } else {
        result = await sendWhatsAppMessage(phone, text, config);
      }

      if (!result.error) {
        const data = loadData();
        if (!data.conversations[phone]) {
          data.conversations[phone] = { name: phone, phone, messages: [], unread: 0 };
        }
        const msg = {
          id: result.messages?.[0]?.id || Date.now().toString(),
          text: useTemplate ? `[Template: ${templateName}]` : text,
          direction: 'out',
          timestamp: Date.now(),
          status: 'sent'
        };
        data.conversations[phone].messages.push(msg);
        data.conversations[phone].lastMessage = msg.text;
        data.conversations[phone].lastTs = Date.now();
        saveData(data);
      }

      results.push({ phone, success: !result.error, error: result.error?.message });
      await new Promise(r => setTimeout(r, 300)); // rate limiting
    } catch (e) {
      results.push({ phone, success: false, error: e.message });
    }
  }

  res.json({ results });
});

// ─── API: contacts ─────────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  const data = loadData();
  res.json(Object.values(data.contacts));
});

app.post('/api/contacts', (req, res) => {
  const { name, phone } = req.body;
  const data = loadData();
  const clean = phone.replace(/\D/g, '');
  data.contacts[clean] = { name, phone: clean };
  saveData(data);
  res.json({ ok: true });
});

app.delete('/api/contacts/:phone', (req, res) => {
  const data = loadData();
  delete data.contacts[req.params.phone];
  saveData(data);
  res.json({ ok: true });
});

// ─── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🟢 WA Manager avviato su http://localhost:${PORT}`);
  console.log(`📌 Webhook URL da configurare su Meta: https://TUO-DOMINIO/webhook`);
  console.log(`🔑 Verify Token: ${loadConfig().verifyToken || 'myverifytoken123'}\n`);
});
