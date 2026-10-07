import {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  FileUploadBuilder,
  AttachmentBuilder,
  Events,
  MessageFlags,
} from "discord.js";

export const issueDefinition = new SlashCommandBuilder()
  .setName("issue")
  .setDescription("Post a scheduled task (set, add, or delete) to the issues channel")
  .toJSON();

const ISSUE_TYPES = [
  { label: "Set", value: "set", description: "Set a scheduled task" },
  { label: "Add", value: "add", description: "Add to a scheduled task" },
  { label: "Delete", value: "delete", description: "Delete a scheduled task" },
];

export function setupIssues(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "issue") {
        return await showIssueModal(interaction, config);
      }
      if (interaction.isModalSubmit() && interaction.customId === "issue:create") {
        return await createIssue(client, interaction, config);
      }
    } catch (err) {
      console.error("issue interaction error", err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}

async function showIssueModal(interaction, config) {
  if (!interaction.inGuild() || !config.issueChannelId) {
    await interaction.reply({ content: "Issues are not configured.", flags: MessageFlags.Ephemeral });
    return;
  }

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId("issueType")
    .setPlaceholder("Select an action")
    .setRequired(true)
    .addOptions(
      ISSUE_TYPES.map((t) =>
        new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.value).setDescription(t.description)
      )
    );

  const titleInput = new TextInputBuilder()
    .setCustomId("title")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Title of the task")
    .setMaxLength(120)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("description")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Describe the task in detail")
    .setMinLength(10)
    .setMaxLength(2000)
    .setRequired(true);

  const imageInput = new FileUploadBuilder().setCustomId("image").setRequired(false).setMaxValues(1);

  const modal = new ModalBuilder().setCustomId("issue:create").setTitle("Create Issue").addLabelComponents(
    new LabelBuilder().setLabel("Type").setStringSelectMenuComponent(typeSelect),
    new LabelBuilder().setLabel("Title").setTextInputComponent(titleInput),
    new LabelBuilder().setLabel("Description").setTextInputComponent(descriptionInput),
    new LabelBuilder().setLabel("Image (optional)").setFileUploadComponent(imageInput)
  );

  await interaction.showModal(modal);
}

async function createIssue(client, interaction, config) {
  const typeValue = interaction.fields.getStringSelectValues("issueType")[0];
  const typeLabel = (ISSUE_TYPES.find((t) => t.value === typeValue) || {}).label || typeValue;
  const title = interaction.fields.getTextInputValue("title");
  const description = interaction.fields.getTextInputValue("description");
  const files = interaction.fields.getUploadedFiles("image");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = await client.channels.fetch(config.issueChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({ content: "Issue channel not found." });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(title.slice(0, 256))
    .setColor(0x5865f2)
    .addFields(
      { name: "Type", value: typeLabel, inline: true },
      { name: "Posted by", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Description", value: description.slice(0, 1024) }
    )
    .setTimestamp(new Date());

  const payload = { embeds: [embed] };

  if (files && files.size > 0) {
    const file = files.first();
    try {
      const res = await fetch(file.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const safeName = (file.name || "image.png").replace(/\s+/g, "_");
      payload.files = [new AttachmentBuilder(buffer, { name: safeName })];
      embed.setImage(`attachment://${safeName}`);
    } catch (err) {
      console.error("issue image upload failed", err);
    }
  }

  const message = await channel.send(payload);
  await interaction.editReply({
    content: `Posted: https://discord.com/channels/${interaction.guildId}/${channel.id}/${message.id}`,
  });
}
