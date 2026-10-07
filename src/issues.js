import { SlashCommandBuilder, EmbedBuilder, Events, MessageFlags } from "discord.js";

export const issueDefinition = new SlashCommandBuilder()
  .setName("issue")
  .setDescription("Post an issue card to the issues channel")
  .addStringOption((o) =>
    o.setName("state").setDescription("State of the card").setRequired(true).setMaxLength(100)
  )
  .addStringOption((o) =>
    o.setName("description").setDescription("Content of the card").setRequired(true).setMaxLength(4000)
  )
  .toJSON();

const EMBED_COLOR = 0x2f3136;

export function setupIssues(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "issue") return;

    try {
      if (!config.issueChannelId) {
        await interaction.reply({ content: "Issues are not configured.", flags: MessageFlags.Ephemeral });
        return;
      }

      const state = interaction.options.getString("state");
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

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setAuthor({ name: authorName, iconURL: authorIcon })
        .setDescription(description)
        .setFooter({ text: state })
        .setTimestamp(new Date());

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
