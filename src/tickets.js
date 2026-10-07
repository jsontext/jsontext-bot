import {
  SlashCommandBuilder,
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

export const ticketDefinition = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Open a support ticket")
  .toJSON();

export const panelDefinition = new SlashCommandBuilder()
  .setName("ticketpanel")
  .setDescription("Post the ticket panel with instructions")
  .addChannelOption((o) => o.setName("channel").setDescription("Channel to post the panel in (defaults to current)"))
  .toJSON();

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
  { label: "Technical / Bug", value: "bug", description: "Report a bug or technical problem" },
  { label: "Purchase / Robux", value: "purchase", description: "Issues with a purchase or Robux" },
  { label: "General question", value: "question", description: "Ask staff a general question" },
];

const PANEL = `# 🎫 Server Support Tickets

Need help from staff? Click the **Open Ticket** button below.
-# Choose a category, fill out every required field accurately, and submit. A private channel is created for you and staff.

**Support Rules**

**1. Complete All Mandatory Fields Before Submission**
-# Every designated prompt, template question, and required field must be accurately and thoroughly filled out before opening a ticket. Submissions containing placeholder text, incomplete details, or blank responses will be closed without action until proper information is provided.

**2. Tickets Are for Legitimate Support Only: No Trolling or Pranks**
-# The ticketing system is reserved strictly for genuine inquiries, technical help, and server reports. Opening tickets to spam, test bots, send memes, troll staff, or waste moderator time will result in an immediate ticket termination and a temporary or permanent restriction from support channels.

**3. Protect Confidentiality: Do Not Share Personal Identifiable Information (PII)**
-# For the safety of everyone involved, never share your own or anyone else's private personal information within tickets. This includes real names, physical addresses, phone numbers, private photos, passwords, financial records, IP addresses, or off-platform communication logs without consent.

**4. Keep Inquiries Focused and Professional**
-# Use one ticket per individual issue, explain your problem clearly in a single descriptive overview, and avoid opening multiple tickets for the same request. Maintaining clear, concise, and courteous communication allows our support team to investigate and resolve your request as efficiently as possible.`;

export function setupTickets(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {
        return await showTicketModal(interaction, config);
      }
      if (interaction.isChatInputCommand() && interaction.commandName === "ticketpanel") {
        return await postPanel(client, interaction, config);
      }
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

  const evidenceInput = new TextInputBuilder()
    .setCustomId("evidence")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Optional: links or references to evidence")
    .setMaxLength(1000)
    .setRequired(false);

  const modal = new ModalBuilder().setCustomId("ticket:create").setTitle("Open a Ticket").addLabelComponents(
    new LabelBuilder().setLabel("Ticket type").setStringSelectMenuComponent(typeSelect),
    new LabelBuilder().setLabel("Summary").setTextInputComponent(summaryInput),
    new LabelBuilder().setLabel("What happened?").setTextInputComponent(detailsInput),
    new LabelBuilder().setLabel("Evidence (optional)").setTextInputComponent(evidenceInput)
  );

  await interaction.showModal(modal);
}

async function postPanel(client, interaction, config) {
  if (!interaction.inGuild() || !config.ticketCategoryId || !config.staffRoleId) {
    await interaction.reply({ content: "Tickets are not configured.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.member.roles.cache.has(config.staffRoleId)) {
    await interaction.reply({ content: "Only staff can post the ticket panel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const target = interaction.options.getChannel("channel") || interaction.channel;
  if (!target || !target.isTextBased()) {
    await interaction.reply({ content: "Invalid channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket:open").setLabel("Open Ticket").setStyle(ButtonStyle.Primary).setEmoji("🎫")
  );

  if (PANEL.length <= 1900) {
    await target.send({ content: PANEL, components: [row] });
  } else {
    await target.send({ content: PANEL });
    await target.send({ content: "**Click below to open a ticket.**", components: [row] });
  }

  await interaction.reply({ content: `Panel posted in <#${target.id}>.`, flags: MessageFlags.Ephemeral });
}

async function createTicket(client, interaction, config) {
  const typeValue = interaction.fields.getStringSelectValues("ticketType")[0];
  const typeLabel = (TICKET_TYPES.find((t) => t.value === typeValue) || {}).label || typeValue;
  const summary = interaction.fields.getTextInputValue("summary");
  const details = interaction.fields.getTextInputValue("details");
  const evidence = interaction.fields.getTextInputValue("evidence");

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

  if (evidence) embed.addFields({ name: "Evidence", value: evidence });

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
