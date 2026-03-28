// dotenv sadece lokal için (Railway'de sorun çıkarmaz)
require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

// =========================
// ENV (Railway buradan okuyacak)
// =========================
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const DELETE_AFTER_MS = Number(process.env.DELETE_AFTER_MS || 5000);
const PORT = Number(process.env.PORT || 3000);

// =========================
// Railway için web server
// =========================
const app = express();

app.get("/", (_req, res) => {
  res.send("Bot aktif");
});

app.listen(PORT, () => {
  console.log(`Web server çalışıyor: ${PORT}`);
});

// =========================
// Discord Client
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// =========================
// SES BAĞLANTISI
// =========================
async function connectToVoice() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return console.log("Guild bulunamadı");

    const channel = await guild.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return console.log("Ses kanalı bulunamadı");
    }

    let connection = getVoiceConnection(guild.id);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      console.log("Ses kanalına bağlandı");
    }

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log("Ses düştü, tekrar bağlanıyor...");

      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch {
        connection.destroy();
        setTimeout(connectToVoice, 5000);
      }
    });

  } catch (err) {
    console.log("Ses hatası:", err.message);
  }
}

// =========================
// HOŞ GELDİN MESAJI
// =========================
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== GUILD_ID) return;

  try {
    const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);

    if (!channel || !channel.isTextBased()) return;

    const msg = await channel.send(`Hoş geldin ${member}`);

    setTimeout(() => {
      msg.delete().catch(() => {});
    }, DELETE_AFTER_MS);

  } catch (err) {
    console.log("Mesaj hatası:", err.message);
  }
});

// =========================
// BOT HAZIR OLUNCA
// =========================
client.once(Events.ClientReady, async () => {
  console.log(`${client.user.tag} aktif`);
  await connectToVoice();
});

// =========================
// BOT Sesten düşerse tekrar bağlan
// =========================
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (
    oldState.member?.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    console.log("Bot sesten düştü tekrar giriyor...");
    setTimeout(connectToVoice, 5000);
  }
});

// =========================
// LOGIN
// =========================
client.login(TOKEN);
