import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  MessageFlags,
} from "discord.js";
import { nextTicketNumber, addTicket, getTicket, removeTicket } from "./store.js";

export const ticketDefinition = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Open a support ticket")
  .toJSON();

const MEMBER_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

export function setupTickets(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {
        return await openTicket(client, interaction, config);
      }
      if (interaction.isButton() && interaction.customId === "ticket:close") {
        return await closeTicket(client, interaction, config);
      }
    } catch (err) {
      console.error("ticket interaction error", err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}

async function openTicket(client, interaction, config) {
  if (!interaction.inGuild() || !config.ticketCategoryId || !config.staffRoleId) {
    await interaction.reply({ content: "Tickets are not configured.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const number = nextTicketNumber();
  const name = `ticket-${String(number).padStart(4, "0")}`;

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    topic: `Ticket #${number} | opener: ${interaction.user.id}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: MEMBER_ALLOW },
      { id: config.staffRoleId, allow: MEMBER_ALLOW },
      { id: client.user.id, allow: [...MEMBER_ALLOW, PermissionFlagsBits.ManageChannels] },
    ],
  });

  addTicket(channel.id, { number, ownerId: interaction.user.id, createdAt: Date.now() });

  const embed = new EmbedBuilder()
    .setTitle(`Ticket #${number}`)
    .setDescription(`Hello <@${interaction.user.id}>, staff will be with you shortly.\n\nWhen you're done, press **Close Ticket** below.`)
    .setColor(0x5865f2)
    .setTimestamp(new Date());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket:close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@${interaction.user.id}> <@&${config.staffRoleId}>`, embeds: [embed], components: [row] });
  await interaction.editReply({ content: `Your ticket is open: <#${channel.id}>` });
}

async function closeTicket(client, interaction, config) {
  const ticket = getTicket(interaction.channelId);
  const member = interaction.member;
  const isStaff = member.roles.cache.has(config.staffRoleId);
  const isOwner = ticket && ticket.ownerId === interaction.user.id;

  if (!ticket || (!isStaff && !isOwner)) {
    await interaction.reply({ content: "Only the ticket opener or staff can close this.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content: "Closing ticket...", flags: MessageFlags.Ephemeral });
  removeTicket(interaction.channelId);
  setTimeout(() => {
    interaction.channel.delete().catch((err) => console.error("ticket delete failed", err));
  }, 3000);
}
