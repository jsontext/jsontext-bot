import { SlashCommandBuilder, EmbedBuilder, Events, MessageFlags } from "discord.js";

export const issueDefinition = new SlashCommandBuilder()
  .setName("issue")
  .setDescription("Post an issue to the issues channel")
  .addStringOption((o) =>
    o
      .setName("status")
      .setDescription("Issue status")
      .setRequired(true)
      .addChoices(
        { name: "completed", value: "completed" },
        { name: "volatile", value: "volatile" },
        { name: "working", value: "working" }
      )
  )
  .addStringOption((o) => o.setName("description").setDescription("Description").setRequired(true).setMaxLength(2000))
  .toJSON();

const STATUS = {
  completed: { label: "Completed", color: 0x57f287 },
  volatile: { label: "Volatile", color: 0x5865f2 },
  working: { label: "Working", color: 0xe67e22 },
};

export function setupIssues(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "issue") return;

    try {
      if (!config.issueChannelId) {
        await interaction.reply({ content: "Issues are not configured.", flags: MessageFlags.Ephemeral });
        return;
      }

      const statusValue = interaction.options.getString("status");
      const description = interaction.options.getString("description");
      const meta = STATUS[statusValue] || { label: statusValue, color: 0x5865f2 };

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const channel = await client.channels.fetch(config.issueChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({ content: "Issue channel not found." });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(meta.label)
        .setColor(meta.color)
        .setDescription(description)
        .setFooter({ text: `Posted by ${interaction.user.tag ?? interaction.user.username}` })
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
