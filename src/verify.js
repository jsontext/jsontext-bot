import crypto from "node:crypto";
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, MessageFlags } from "discord.js";

export const spawnVerifyDefinition = new SlashCommandBuilder()
  .setName("spawnverifybutton")
  .setDescription("Spawn a 'Verify yourself' button in this channel")
  .toJSON();

const PANEL_TEXT =
  "**Verify Your Roblox Account**\n" +
  "-# Fast, safe, and automated. This process uses Roblox's official OAuth 2.0 API to link your profile without ever accessing your password or sensitive data.";

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
      `**[Verify](${link}) Your Roblox Account**\n` +
      "-# Fast, safe, and automated. This process uses Roblox's official OAuth 2.0 API to link your profile without ever accessing your password or sensitive data.",
    flags: MessageFlags.Ephemeral,
  });
}

export function setupVerify(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === "spawnverifybutton") {
      if (config.staffRoleId && interaction.member && !interaction.member.roles.cache.has(config.staffRoleId)) {
        await interaction.reply({ content: "Only staff can spawn the verify button.", flags: MessageFlags.Ephemeral });
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("verify:start").setLabel("Verify yourself").setStyle(ButtonStyle.Primary)
      );
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.channel.send({ content: PANEL_TEXT, components: [row] });
      await interaction.editReply({ content: "Verify button posted." });
      return;
    }

    if (interaction.isButton() && interaction.customId === "verify:start") {
      await replyWithLink(interaction, config);
    }
  });
}
