require("dotenv").config();

let lastNotifiedCampaignId = null;
const { Client, GatewayIntentBits } = require("discord.js");
const fetch = require("node-fetch");

// Config da .env
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES || "15", 10);

// URL della sezione "News" del forum di Fishing Planet
const FORUM_NEWS_URL =
  "https://forum.fishingplanet.com/index.php?/forum/62-news/";

// Client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Qui teniamo in memoria l’ultimo titolo di campagna drops visto
let lastDropTitle = null;

/**
 * Scarica la pagina delle news e trova i topic che parlano di Twitch Drops.
 */
async function fetchFishingPlanetDropCampaigns() {
  const res = await fetch(FORUM_NEWS_URL, {
    headers: {
      "User-Agent": "FishingPlanetDropsDiscordBot/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Impossibile leggere il forum (status ${res.status} ${res.statusText})`
    );
  }

  const html = await res.text();

  // Cerchiamo link che contengono la parola "Drops"
  const regex = /<a[^>]+href="([^"]+)"[^>]*>([^<]*Drops[^<]*)<\/a>/gi;

  const campaigns = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    let url = match[1];
    let title = match[2].replace(/\s+/g, " ").trim();

    // Normalizza l'URL relativo
    if (url.startsWith("/")) {
      url = "https://forum.fishingplanet.com" + url;
    } else if (url.startsWith("index.php")) {
      url = "https://forum.fishingplanet.com/" + url;
    }

    // Evita duplicati
    if (!campaigns.some((c) => c.url === url)) {
      campaigns.push({ title, url });
    }
  }

  return campaigns;
}

/**
 * Controlla se ci sono nuove campagne Twitch Drops e, se sì, avvisa su Discord.
 */
async function checkForNewDrops() {
  try {
    console.log("🔍 Controllo nuove campagne Twitch Drops...");

    const campaigns = await fetchFishingPlanetDropCampaigns();

    if (!campaigns || campaigns.length === 0) {
      console.log("Nessuna campagna Drops trovata nella pagina news.");
      return;
    }

    const latest = campaigns.find(c =>
  c.title.toLowerCase().includes("twitch drops")
);

if (!latest) {
  console.log("Nessuna campagna Twitch Drops trovata tra i topic.");
  return;
}


    console.log(`Ultima campagna trovata: ${latest.title}`);

    if (lastDropTitle === null) {
      lastDropTitle = latest.title;
      console.log("Inizializzo lastDropTitle, nessuna notifica inviata.");
      return;
    }

    if (latest.title !== lastDropTitle) {
      lastDropTitle = latest.title;

      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) {
        console.error(
          "❌ Canale non trovato! Controlla DISCORD_CHANNEL_ID nel file .env"
        );
        return;
      }

      const message = [
        "🎣 **Nuova campagna Twitch Drops per Fishing Planet!**",
        "",
        `📢 **${latest.title}**`,
        `🔗 Dettagli: ${latest.url}`,
        "",
        "Ricorda di collegare il tuo account di gioco a Twitch:",
        "https://twitch.fishingplanet.com/",
      ].join("\n");

      const campaignId = latest.url;

      if (campaignId !== lastNotifiedCampaignId) {
        lastNotifiedCampaignId = campaignId;
        await channel.send(`@everyone\n${message}`);
        console.log("✅ Notifica nuova campagna Drops inviata su Discord (con @everyone).");
      } else {
        console.log("Campagna già notificata, niente @everyone.");
      }

    } else {
      console.log("Nessuna nuova campagna rispetto all’ultimo controllo.");
    }
  } catch (err) {
    console.error("Errore durante il controllo dei Drops:", err);
  }
}

// Evento: il bot è pronto
client.once("ready", () => {
  console.log(`✅ Bot loggato come ${client.user.tag}`);

  checkForNewDrops();

  const intervalMs = CHECK_INTERVAL_MINUTES * 60 * 1000;
  console.log(
    `⏱  Controllo programmato ogni ${CHECK_INTERVAL_MINUTES} minuti.`
  );
  setInterval(checkForNewDrops, intervalMs);
});
// Comando di test: scrive un finto annuncio di Twitch Drops quando qualcuno scrive !testdrops
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!testdrops") {
    const fakeTitle = "Campagna Twitch Drops di TEST per Fishing Planet";
    const fakeUrl = "https://twitch.fishingplanet.com/";

    const text = [
      "🎣 **Nuova campagna Twitch Drops per Fishing Planet! (TEST)**",
      "",
      `📢 **${fakeTitle}**`,
      `🔗 Dettagli: ${fakeUrl}`,
      "",
      "Questo è solo un messaggio di *prova* generato con il comando `!testdrops`.",
    ].join("\n");

    await message.channel.send(text);
    console.log("✅ Messaggio di test Drops inviato.");
  }
  if (message.content === "!forceping") {
    const latest = {
      title: "Campagna Twitch Drops FORZATA (TEST)",
      url: "https://twitch.fishingplanet.com/?forced=1"
    };

    const channel = message.channel;

    const text = [
      "🎣 **Nuova campagna Twitch Drops per Fishing Planet! (FORZATA)**",
      "",
      `📢 **${latest.title}**`,
      `🔗 Dettagli: ${latest.url}`,
    ].join("\n");

    const campaignId = latest.url;

    if (campaignId !== lastNotifiedCampaignId) {
      lastNotifiedCampaignId = campaignId;
      await channel.send(`@everyone\n${text}`);
      console.log("✅ Forceping: inviato con @everyone (prima volta).");
    } else {
      await channel.send("✅ Forceping: già notificato, niente @everyone.");
      console.log("Forceping: già notificato.");
    }
  }

});

client.login(DISCORD_TOKEN);
// --- HTTP server fittizio per Render (mantiene il bot online) ---
const http = require("http");

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Fishing Planet Drops Bot is running");
}).listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});





