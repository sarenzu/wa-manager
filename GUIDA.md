# 📱 Guida: WhatsApp Cloud API — Configurazione da Zero
## WA Manager — TutelaAuto

---

## Cosa otterrai

Un numero WhatsApp Business ufficiale connesso alla tua web app, 
capace di ricevere e inviare messaggi e broadcast, 
pagando solo le tariffe Meta (~€0,055/msg marketing, 0€ per risposte entro 24h).

---

## PARTE 1 — Account Meta Business

### Step 1.1 — Crea il Meta Business Portfolio
1. Vai su https://business.facebook.com
2. Crea un nuovo Business Portfolio (se non ce l'hai)
3. Inserisci nome azienda, email, sito web

### Step 1.2 — Verifica l'azienda (opzionale ma consigliato)
- Vai su Impostazioni Business → Verifica dell'azienda
- Carica i documenti richiesti (visura camerale o P. IVA)
- La verifica sblocca limiti più alti di messaggi

---

## PARTE 2 — Meta Developer App

### Step 2.1 — Crea l'app sviluppatore
1. Vai su https://developers.facebook.com/apps
2. Clicca **Crea app**
3. Seleziona tipo: **Business**
4. Collega al tuo Meta Business Portfolio
5. Dai un nome all'app (es. "TutelaAuto WA")

### Step 2.2 — Aggiungi WhatsApp al prodotto
1. Nella dashboard dell'app, clicca **Aggiungi prodotto**
2. Trova **WhatsApp** e clicca **Configura**
3. Nella sezione WhatsApp → **Configurazione API**

### Step 2.3 — Ottieni le credenziali

Nella pagina **WhatsApp → Configurazione API** trovi:

- **Phone Number ID** → copialo (es. 1234567890123)
- **WhatsApp Business Account ID** → copialo
- **Token temporaneo** → valido 24h (per i test iniziali)

⚠️ Per un token permanente vedi Step 2.4

### Step 2.4 — Token permanente (System User)
1. Vai su https://business.facebook.com → Impostazioni → Utenti di sistema
2. Crea un **Utente di sistema Amministratore**
3. Clicca **Genera token**
4. Seleziona la tua app
5. Permessi necessari: `whatsapp_business_messaging`, `whatsapp_business_management`
6. Genera e salva il token — non sarà più visibile dopo

---

## PARTE 3 — Numero di telefono WhatsApp

### Opzione A — Usa il numero di test (subito, gratis)
Meta fornisce un numero di test con 5 contatti verificabili.
Utile per sviluppo, non adatto alla produzione.

### Opzione B — Aggiungi il tuo numero
1. WhatsApp → Gestione numeri di telefono → **Aggiungi numero**
2. Il numero NON deve essere già associato ad un account WhatsApp
   (se lo è, devi prima dissociarlo dall'app WhatsApp)
3. Verifica via SMS o chiamata
4. Configura nome visualizzato e categoria

💡 **Puoi acquistare un numero SIM virtuale italiano** da:
- Iliad, WindTre o qualsiasi operatore per una SIM nuova
- Oppure un numero VoIP virtuale da Twilio, Telnyx (~€1/mese)

---

## PARTE 4 — Configurare il Webhook

Il webhook permette a Meta di inviare i messaggi in arrivo alla tua app.

### Step 4.1 — Hai bisogno di un URL pubblico

**Per produzione** (scelta raccomandata):
- Deploy su **Render.com** (piano gratuito disponibile):
  1. Crea account su render.com
  2. Nuovo Web Service → Connect GitHub repo
  3. Deploy automatico con URL tipo `https://wa-manager-xxx.onrender.com`

- Oppure VPS economico: Hetzner CX11 (~€4/mese), metti il server lì

**Per test in locale** (temporaneo):
```bash
# Installa ngrok da ngrok.com
ngrok http 3000
# Ottieni URL tipo https://xxxx.ngrok.io
```

### Step 4.2 — Configura il webhook su Meta
1. Nella console Meta Developer → WhatsApp → Configurazione
2. Sezione **Webhook** → **Modifica**
3. **Callback URL**: `https://TUO-DOMINIO/webhook`
4. **Verify Token**: quello che hai impostato nella web app (default: `myverifytoken123`)
5. Clicca **Verifica e salva**
6. Dopo la verifica, iscriviti agli eventi: `messages`, `message_deliveries`, `message_reads`

---

## PARTE 5 — Installare e avviare la web app

### Requisiti
- Node.js 18+ (scarica da https://nodejs.org)

### Installazione
```bash
# Decomprimi il pacchetto ed entra nella cartella
cd wa-manager

# Installa le dipendenze (solo la prima volta)
npm install

# Avvia il server
npm start
```

Apri il browser su **http://localhost:3000**

### Per tenerlo sempre attivo in produzione su VPS
```bash
# Installa pm2 (process manager)
npm install -g pm2

# Avvia con pm2
pm2 start server.js --name wa-manager
pm2 save
pm2 startup
```

---

## PARTE 6 — Configurare la web app

1. Apri la web app nel browser
2. Vai su **⚙️ Impostazioni**
3. Inserisci:
   - **Access Token** (permanente da System User)
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Verify Token** (stesso che hai inserito su Meta)
4. Salva

Il pallino verde in alto a destra indica che sei connesso ✅

---

## PARTE 7 — Test

### Invia un messaggio di test
1. Su Meta Developer → WhatsApp → Configurazione API
2. Nella sezione **Invia e ricevi messaggi**
3. Inserisci il tuo numero personale come destinatario
4. Invia il messaggio di test
5. Rispondi dal tuo telefono → la risposta apparirà nella web app

### Aggiungi contatti e fai un broadcast
1. Vai su **👥 Contatti** → aggiungi un numero
2. Vai su **📢 Broadcast** → seleziona il contatto → invia

---

## Costi Meta (aggiornati luglio 2025)

| Tipo | Costo (Italia) |
|------|---------------|
| Risposta entro 24h da msg cliente | **Gratuito** |
| Template Marketing | ~€0,055/messaggio |
| Template Utility | ~€0,02/messaggio |
| Template Autenticazione | ~€0,02/messaggio |
| Chiamate in entrata (WA Calling) | Gratuito |

Primi 1.000 messaggi di servizio al mese: **gratuiti**

---

## Struttura file del progetto

```
wa-manager/
├── server.js          ← Backend Node.js (webhook + API)
├── package.json       ← Dipendenze
├── public/
│   └── index.html     ← Web app (chat + broadcast)
├── data/
│   ├── messages.json  ← Storico conversazioni (autogenerato)
│   └── config.json    ← Credenziali Meta (autogenerato)
└── GUIDA.md           ← Questo file
```

---

## Domande frequenti

**Il numero può essere quello del mio telefono?**
Sì, ma perdi l'accesso all'app WhatsApp normale su quel numero.
Meglio usare una SIM separata o un numero virtuale VoIP.

**Posso ricevere messaggi in arrivo?**
Sì, tramite webhook. Funziona solo con URL pubblico (non localhost).

**I messaggi vengono salvati?**
Sì, in `data/messages.json`. Per un database più robusto si può
evolvere verso SQLite o PostgreSQL.

**Come aggiorno il token quando scade?**
Con il System User il token è permanente. Con il token temporaneo 
(24h) devi rigenerarlo dalla console Meta.

---

*Sviluppato con Claude — TutelaAuto S.r.l.*
