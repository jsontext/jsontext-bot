import crypto from "node:crypto";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  Events,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { saveVerifiedUser, getVerifiedByDiscord, getVerifiedByRoblox } from "./store.js";

export const findDefinition = new SlashCommandBuilder()
  .setName("find")
  .setDescription("Look up a verified user's linked Discord and Roblox IDs")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((o) => o.setName("user").setDescription("Discord user to look up"))
  .addStringOption((o) => o.setName("roblox_id").setDescription("Roblox user ID to look up"))
  .toJSON();

const TOKEN_TTL_SECONDS = 900;
const COOLDOWN_MS = 30_000;
const TOKEN_REUSE_BUFFER_MS = 60_000;
const verifyCache = new Map();

export function signVerifyToken(discordId, secret, ttlSeconds = TOKEN_TTL_SECONDS) {
  const payload = { d: discordId, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

async function replyWithLink(interaction, config) {
  if (!config.hmacSecret) {
    await interaction.reply({ content: "Verification is not configured.", flags: MessageFlags.Ephemeral });
    return;
  }

  const now = Date.now();
  const userId = interaction.user.id;
  const cached = verifyCache.get(userId);

  if (cached && now < cached.cooldownUntil) {
    const waitSeconds = Math.ceil((cached.cooldownUntil - now) / 1000);
    await interaction.reply({
      content: `Please wait ${waitSeconds}s before requesting another verification link.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const canReuse = cached && now < cached.expiresAt - TOKEN_REUSE_BUFFER_MS;
  const token = canReuse ? cached.token : signVerifyToken(userId, config.hmacSecret, TOKEN_TTL_SECONDS);
  const expiresAt = canReuse ? cached.expiresAt : now + TOKEN_TTL_SECONDS * 1000;

  if (verifyCache.size > 500) verifyCache.clear();
  verifyCache.set(userId, { token, expiresAt, cooldownUntil: now + COOLDOWN_MS });

  const link = `${config.verifyBaseUrl}/?t=${token}`;

  await interaction.reply({
    content:
      `**[Verify](${link}) Your Roblox Account**\n` +
      "-# Fast, safe, and automated. This process uses Roblox's official OAuth 2.0 API to link your profile without ever accessing your password or sensitive data.",
    flags: MessageFlags.Ephemeral,
  });
}

export function setupVerify(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === "find") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "Only administrators can use this command.", flags: MessageFlags.Ephemeral });
        return;
      }

      const targetUser = interaction.options.getUser("user");
      const robloxId = interaction.options.getString("roblox_id");
      if (!targetUser && !robloxId) {
        await interaction.reply({ content: "Provide a Discord user or a Roblox ID.", flags: MessageFlags.Ephemeral });
        return;
      }

      const record = targetUser ? getVerifiedByDiscord(targetUser.id) : getVerifiedByRoblox(robloxId);
      if (!record) {
        await interaction.reply({ content: "No verification record found.", flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("Verification Record")
        .setColor(0x2ea44f)
        .addFields(
          { name: "Discord", value: `<@${record.discordId}> (\`${record.discordId}\`)`, inline: true },
          { name: "Roblox", value: `${record.robloxUsername || "unknown"} (\`${record.robloxId}\`)`, inline: true }
        )
        .setTimestamp(new Date(record.verifiedAt));

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.isButton() && interaction.customId === "verify:start") {
      await replyWithLink(interaction, config);
    }
  });

  client.on(Events.MessageCreate, (message) => {
    if (!config.logChannelId || message.channelId !== config.logChannelId) return;
    if (!client.user || message.author?.id !== client.user.id) return;

    for (const embed of message.embeds) {
      const footerText = embed.footer?.text;
      if (!footerText || !footerText.startsWith("verify-sync:")) continue;

      const [, discordId, robloxId, ...usernameParts] = footerText.split(":");
      if (!discordId || !robloxId) continue;

      saveVerifiedUser(discordId, {
        robloxId,
        robloxUsername: usernameParts.join(":"),
        verifiedAt: message.createdAt?.toISOString(),
      });
    }
  });
}
