import { SlashCommandBuilder, EmbedBuilder, Events, MessageFlags } from "discord.js";

export const issueDefinition = new SlashCommandBuilder()
  .setName("issue")
  .setDescription("Post an issue to the issues channel")
  .addStringOption((o) => o.setName("description").setDescription("Description").setRequired(true).setMaxLength(2000))
  .toJSON();

const EMBED_COLOR = 0x808080;

export function setupIssues(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "issue") return;

    try {
      if (!config.issueChannelId) {
        await interaction.reply({ content: "Issues are not configured.", flags: MessageFlags.Ephemeral });
        return;
      }

      const description = interaction.options.getString("description");

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

      const unix = Math.floor(Date.now() / 1000);

      const embed = new EmbedBuilder()
        .setAuthor({ name: `${authorName} • <t:${unix}:f>`, iconURL: authorIcon })
        .setColor(EMBED_COLOR)
        .setDescription(description);

      const message = await channel.send({ embeds: [embed] });
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
