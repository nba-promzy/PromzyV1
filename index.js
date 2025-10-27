import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import NodeCache from "node-cache";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const msgRetry = new NodeCache();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Promzy v1", "Chrome", "10.0.0"],
    generateHighQualityLinkPreview: true,
    msgRetryCounterCache: msgRetry,
  });

  // Pair code generation
  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER;
    if (!phoneNumber) {
      console.log("❌ Set your phone number in Render environment variable PHONE_NUMBER");
      process.exit(1);
    }
    const code = await sock.requestPairingCode(phoneNumber);
    console.log(`🔗 Pair code for ${phoneNumber}: ${code}`);
  }

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") console.log("✅ Promzy v1 Connected!");
    if (connection === "close") console.log("❌ Connection closed!");
  });

  // All commands here
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    const send = (txt) => sock.sendMessage(from, { text: txt });

    switch (text.toLowerCase()) {
      case ".alive":
        send("🤖 *Promzy v1 is online and working!*");
        break;

      case ".status":
        send("🟢 *Promzy v1 connection:* Stable and running!");
        break;

      case ".ping":
        const start = Date.now();
        await send("🏓 Pinging...");
        const end = Date.now() - start;
        send(`📶 Pong! Response time: *${end}ms*`);
        break;

      case ".menu":
      case ".help":
        send(`📜 *Promzy v1 Commands:*

.alive  – check if bot online  
.menu / .help – show this menu  
.status – show bot status  
.ping – check bot speed  
.owner – show owner info  
.time – show current time  
.quote – random motivational quote  
.tagall – mention everyone in group  
.tictactoe – play TicTacToe 🎮`);
        break;

      case ".owner":
        send("👑 *Owner:* Promzy\n📞 +233 245529834");
        break;

      case ".time":
        send("⏰ Current time: " + new Date().toLocaleString());
        break;

      case ".quote":
        const quotes = [
          "🔥 Believe in yourself and conquer the day!",
          "💪 Never give up on your dreams.",
          "🚀 Success starts with effort.",
          "🌟 You are capable of amazing things!",
          "⚡ Every setback is a setup for a comeback!"
        ];
        send(quotes[Math.floor(Math.random() * quotes.length)]);
        break;

      case ".tictactoe":
        send("🎮 *TicTacToe started!* (Feature demo)");
        break;

      case ".tagall":
        if (!msg.key.participant) return send("⚠️ Use in a group only.");
        const metadata = await sock.groupMetadata(from);
        const members = metadata.participants.map((p) => p.id);
        await sock.sendMessage(from, {
          text: "📣 *Tagging all members!*",
          mentions: members
        });
        break;

      default:
        break;
    }
  });
}

startBot();
