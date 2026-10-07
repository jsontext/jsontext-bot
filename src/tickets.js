import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events,
  MessageFlags,
} from "discord.js";
import { nextTicketNumber, addTicket, getTicket, removeTicket } from "./store.js";

const MEMBER_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

const TICKET_TYPES = [
  { label: "Report a user", value: "report_user", description: "Report a member for breaking rules" },
  { label: "Appeal", value: "appeal", description: "Appeal a ban, kick, or timeout" },
  { label: "Technical", value: "bug", description: "Report a bug or technical problem" },
  { label: "Purchase", value: "purchase", description: "Issues with a purchase or Robux" },
  { label: "General question", value: "question", description: "Ask staff a general question" },
];

export function setupTickets(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId === "ticket:open") {
        return await showTicketModal(interaction, config);
      }
      if (interaction.isModalSubmit() && interaction.customId === "ticket:create") {
        return await createTicket(client, interaction, config);
      }
      if (interaction.isButton() && interaction.customId === "ticket:close") {
        return await closeTicket(interaction, config);
      }
    } catch (err) {
      console.error("ticket interaction error", err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}

async function showTicketModal(interaction, config) {
  if (!interaction.inGuild() || !config.ticketCategoryId || !config.staffRoleId) {
    await interaction.reply({ content: "Tickets are not configured.", flags: MessageFlags.Ephemeral });
    return;
  }

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId("ticketType")
    .setPlaceholder("Choose a category")
    .setRequired(true)
    .addOptions(
      TICKET_TYPES.map((t) =>
        new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.value).setDescription(t.description)
      )
    );

  const summaryInput = new TextInputBuilder()
    .setCustomId("summary")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Short summary of your ticket")
    .setMaxLength(100)
    .setRequired(true);

  const detailsInput = new TextInputBuilder()
    .setCustomId("details")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Describe what happened in detail. Include usernames, times, and evidence/citations.")
    .setMinLength(20)
    .setMaxLength(1500)
    .setRequired(true);

  const modal = new ModalBuilder().setCustomId("ticket:create").setTitle("Open a Ticket").addLabelComponents(
    new LabelBuilder().setLabel("Category").setStringSelectMenuComponent(typeSelect),
    new LabelBuilder().setLabel("Summary").setTextInputComponent(summaryInput),
    new LabelBuilder().setLabel("What happened?").setTextInputComponent(detailsInput)
  );

  await interaction.showModal(modal);
}

async function createTicket(client, interaction, config) {
  const typeValue = interaction.fields.getStringSelectValues("ticketType")[0];
  const typeLabel = (TICKET_TYPES.find((t) => t.value === typeValue) || {}).label || typeValue;
  const summary = interaction.fields.getTextInputValue("summary");
  const details = interaction.fields.getTextInputValue("details");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const number = nextTicketNumber();
  const name = `ticket-${String(number).padStart(4, "0")}`;

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    topic: `Ticket #${number} | ${typeLabel} | opener: ${interaction.user.id}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: MEMBER_ALLOW },
      { id: config.staffRoleId, allow: MEMBER_ALLOW },
      { id: client.user.id, allow: [...MEMBER_ALLOW, PermissionFlagsBits.ManageChannels] },
    ],
  });

  addTicket(channel.id, { number, ownerId: interaction.user.id, type: typeLabel, createdAt: Date.now() });

  const embed = new EmbedBuilder()
    .setTitle(`Ticket #${number} — ${typeLabel}`)
    .setColor(0x5865f2)
    .addFields(
      { name: "Opened by", value: `<@${interaction.user.id}>` },
      { name: "Summary", value: summary || "*(none)*" },
      { name: "Details", value: details || "*(none)*" }
    )
    .setTimestamp(new Date());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket:close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@${interaction.user.id}> <@&${config.staffRoleId}>`, embeds: [embed], components: [row] });
  await interaction.editReply({ content: `Your ticket is open: <#${channel.id}>` });
}

async function closeTicket(interaction, config) {
  const isStaff = interaction.member.roles.cache.has(config.staffRoleId);
  if (!isStaff) {
    await interaction.reply({ content: "Only staff can close tickets.", flags: MessageFlags.Ephemeral });
    return;
  }

  const ticket = getTicket(interaction.channelId);
  if (!ticket) {
    await interaction.reply({ content: "This isn't a ticket channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content: "Closing ticket...", flags: MessageFlags.Ephemeral });
  removeTicket(interaction.channelId);
  setTimeout(() => {
    interaction.channel.delete().catch((err) => console.error("ticket delete failed", err));
  }, 3000);
}
