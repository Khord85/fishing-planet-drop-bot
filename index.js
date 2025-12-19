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
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Impossibile leggere il forum (status ${res.status} ${res.statusText})`
    );
  }

  const html = await res.text();

  // Debug utile: conferma che stiamo leggendo davvero la pagina giusta
  console.log("URL finale:", res.url);
  console.log("HTML length:", html.length);

  const campaigns = [];
  const seen = new Set();

  /**
   * Prendiamo i link ai TOPIC e proviamo a recuperare un titolo da:
   * - testo interno
   * - title=""
   * - aria-label=""
   *
   * Matcha sia /topic/.. sia %2Ftopic%2F.. (URL encoded)
   */
  const topicRegex =
    /<a[^>]+href="([^"]*(?:\/topic\/|%2Ftopic%2F)[^"]+)"[^>]*(?:title="([^"]*)")?[^>]*(?:aria-label="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;

  let m;
  while ((m = topicRegex.exec(html)) !== null) {
    let url = m[1];

    // normalizza URL relativo/strano
    if (url.startsWith("/")) url = "https://forum.fishingplanet.com" + url;
    if (url.startsWith("index.php")) url = "https://forum.fishingplanet.com/" + url;

    // titolo: preferisci title/aria-label, altrimenti testo interno ripulito
    let title = (m[2] || m[3] || m[4] || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!title) continue;

    // filtro drops
    if (!title.toLowerCase().includes("drops")) continue;

    // evita duplicati
    if (seen.has(url)) continue;
    seen.add(url);

    campaigns.push({ title, url });
  }

  console.log(`Trovati ${campaigns.length} topic con "Drops" nella pagina News.`);
  if (campaigns[0]) console.log("Esempio:", campaigns[0].title, campaigns[0].url);

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
  c.title.toLowerCase().includes("drops")
);

if (!latest) {
  console.log("Nessuna campagna Drops trovata tra i topic.");
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








