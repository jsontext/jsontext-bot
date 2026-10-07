import { SlashCommandBuilder, EmbedBuilder, Events, MessageFlags } from "discord.js";

export const issueDefinition = new SlashCommandBuilder()
  .setName("issue")
  .setDescription("Post an issue to the issues channel")
  .addStringOption((o) =>
    o
      .setName("description")
      .setDescription("First line becomes the title; the rest becomes the body")
      .setRequired(true)
      .setMaxLength(6000)
  )
  .toJSON();

const EMBED_COLOR = 0x808080;
const CHUNK = 3800;
const MAX_EMBEDS = 10;

export function setupIssues(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "issue") return;

    try {
      if (!config.issueChannelId) {
        await interaction.reply({ content: "Issues are not configured.", flags: MessageFlags.Ephemeral });
        return;
      }

      const raw = interaction.options.getString("description") || "";

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const channel = await client.channels.fetch(config.issueChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({ content: "Issue channel not found." });
        return;
      }

      const member = interaction.member;
      const authorName =
        member && member.displayName ? member.displayName : interaction.user.globalName || interaction.user.username;
      const authorIcon =
        member && typeof member.displayAvatarURL === "function"
          ? member.displayAvatarURL()
          : interaction.user.displayAvatarURL();

      const lines = raw.split("\n");
      const title = (lines[0] || "").slice(0, 256);
      const body = lines.slice(1).join("\n").trim();

      const chunks = [];
      if (body) {
        for (let i = 0; i < body.length; i += CHUNK) chunks.push(body.slice(i, i + CHUNK));
      }

      const first = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setAuthor({ name: authorName, iconURL: authorIcon });
      if (title) first.setTitle(title);
      if (chunks[0]) first.setDescription("```\n" + chunks[0] + "\n```");

      const embeds = [first];
      for (let i = 1; i < chunks.length && embeds.length < MAX_EMBEDS; i++) {
        embeds.push(new EmbedBuilder().setColor(EMBED_COLOR).setDescription("```\n" + chunks[i] + "\n```"));
      }

      const message = await channel.send({ embeds });
      await interaction.editReply({
        content: `Posted: https://discord.com/channels/${interaction.guildId}/${channel.id}/${message.id}`,
      });
    } catch (err) {
      console.error("issue command error", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}
