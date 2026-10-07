import "dotenv/config";
import { Client, GatewayIntentBits, Partials, Events } from "discord.js";
import { setupModLog } from "./modlog.js";
import { setupMessageLog } from "./messagelog.js";
import { setupTickets, ticketDefinition } from "./tickets.js";
import { setupVerify, verifyDefinition } from "./verify.js";

const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
  logChannelId: process.env.LOG_CHANNEL_ID,
  messageLogChannelId: process.env.MESSAGE_LOG_CHANNEL_ID,
  staffRoleId: process.env.STAFF_ROLE_ID,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  hmacSecret: process.env.HMAC_SECRET,
  verifyBaseUrl: process.env.VERIFY_BASE_URL || "https://jsontext.me",
};

if (!config.token) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  console.log(`Watching guild: ${config.guildId || "(all)"}`);

  c.user.setPresence({
    status: "online",
    activities: [{ name: "moderation logs", type: 3 }],
  });

  if (config.guildId) {
    try {
      const guild = await c.guilds.fetch(config.guildId);
      await guild.commands.set([verifyDefinition, ticketDefinition]);
      console.log("Registered guild commands: /verify, /ticket");
    } catch (err) {
      console.error("command registration failed", err);
    }
  }
});

setupModLog(client, config);
setupMessageLog(client, config);
setupTickets(client, config);
setupVerify(client, config);

client.on(Events.Error, (err) => console.error("client error", err));
client.on(Events.Warn, (msg) => console.warn("client warn", msg));

client.login(config.token);
