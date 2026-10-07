import crypto from "node:crypto";
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  MessageFlags,
} from "discord.js";

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

export function setupVerify(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === "verify") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("verify:start").setLabel("Verify").setStyle(ButtonStyle.Primary)
      );
      await interaction.reply({
        content: "Click the button below to verify your Roblox account.",
        components: [row],
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "verify:start") {
      if (!config.hmacSecret) {
        await interaction.reply({ content: "Verification is not configured.", flags: MessageFlags.Ephemeral });
        return;
      }

      const token = signVerifyToken(interaction.user.id, config.hmacSecret);
      const link = `${config.verifyBaseUrl}/?t=${token}`;

      await interaction.reply({
        content: `**Verify your Roblox account**\n[Click here to verify](${link})\n\nThis link expires in 15 minutes.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  });
}
