import crypto from "node:crypto";
import { SlashCommandBuilder, Events, MessageFlags } from "discord.js";

export const verifyDefinition = new SlashCommandBuilder()
  .setName("verify")
  .setDescription("Get a link to verify your Roblox account")
  .toJSON();

export function signVerifyToken(discordId, secret, ttlSeconds = 900) {
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

  const token = signVerifyToken(interaction.user.id, config.hmacSecret);
  const link = `${config.verifyBaseUrl}/?t=${token}`;

  await interaction.reply({
    content:
      "**Verify Your Roblox Account**\n" +
      "-# Fast, safe, and automated. This process uses Roblox's official OAuth 2.0 API to link your profile without ever accessing your password or sensitive data.\n\n" +
      `[Verify](${link})`,
    flags: MessageFlags.Ephemeral,
  });
}

export function setupVerify(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === "verify") {
      await replyWithLink(interaction, config);
      return;
    }
    if (interaction.isButton() && interaction.customId === "verify:start") {
      await replyWithLink(interaction, config);
    }
  });
}
