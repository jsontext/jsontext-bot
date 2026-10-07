import { SlashCommandBuilder, Events, MessageFlags } from "discord.js";

export const issueDefinition = new SlashCommandBuilder()
  .setName("issue")
  .setDescription("Post an issue to the issues channel")
  .addStringOption((o) =>
    o.setName("description").setDescription("Issue content").setRequired(true).setMaxLength(6000)
  )
  .toJSON();

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

      const id = interaction.user.id;
      const unix = Math.floor(Date.now() / 1000);
      const content = `-# <@${id}> (${id}) have issued the content below.\n\n-# [ <t:${unix}:S> ] : ${description}`;

      const parts = [];
      for (let i = 0; i < content.length; i += 2000) parts.push(content.slice(i, i + 2000));

      let firstMessage = null;
      for (const part of parts) {
        const sent = await channel.send({ content: part, allowedMentions: { parse: [] } });
        if (!firstMessage) firstMessage = sent;
      }

      await interaction.editReply({
        content: `Posted: https://discord.com/channels/${interaction.guildId}/${channel.id}/${firstMessage.id}`,
      });
    } catch (err) {
      console.error("issue command error", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}
