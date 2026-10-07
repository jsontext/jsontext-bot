import { SlashCommandBuilder, Events, MessageFlags } from "discord.js";

export const sendDefinition = new SlashCommandBuilder()
  .setName("send")
  .setDescription("Send a message as the bot")
  .addChannelOption((o) => o.setName("channel").setDescription("Channel to send to (defaults to current)"))
  .addStringOption((o) => o.setName("message").setDescription("Message content").setRequired(true).setMaxLength(2000))
  .toJSON();

export const editDefinition = new SlashCommandBuilder()
  .setName("edit")
  .setDescription("Edit a message the bot sent")
  .addStringOption((o) => o.setName("message").setDescription("Message link or message ID").setRequired(true))
  .addStringOption((o) => o.setName("content").setDescription("New content").setRequired(true).setMaxLength(2000))
  .toJSON();

export function setupMessaging(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      if (interaction.commandName === "send") return await handleSend(client, interaction, config);
      if (interaction.commandName === "edit") return await handleEdit(client, interaction, config);
    } catch (err) {
      console.error("messaging command error", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}

function isStaff(interaction, config) {
  return interaction.member && interaction.member.roles.cache.has(config.staffRoleId);
}

function parseMessageRef(input, fallbackChannelId) {
  const link = input.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
  if (link) return { channelId: link[2], messageId: link[3] };
  if (/^\d+$/.test(input.trim())) return { channelId: fallbackChannelId, messageId: input.trim() };
  return null;
}

async function handleSend(client, interaction, config) {
  if (!isStaff(interaction, config)) {
    await interaction.reply({ content: "Only staff can use this.", flags: MessageFlags.Ephemeral });
    return;
  }

  const target = interaction.options.getChannel("channel") || interaction.channel;
  const content = interaction.options.getString("message");

  if (!target || !target.isTextBased()) {
    await interaction.reply({ content: "Invalid channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const sent = await target.send({ content });
  await interaction.reply({
    content: `Sent: https://discord.com/channels/${interaction.guildId}/${sent.channelId}/${sent.id}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleEdit(client, interaction, config) {
  if (!isStaff(interaction, config)) {
    await interaction.reply({ content: "Only staff can use this.", flags: MessageFlags.Ephemeral });
    return;
  }

  const ref = parseMessageRef(interaction.options.getString("message"), interaction.channelId);
  if (!ref) {
    await interaction.reply({ content: "Provide a valid message link or ID.", flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = await client.channels.fetch(ref.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await interaction.reply({ content: "Could not find that channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  const message = await channel.messages.fetch(ref.messageId).catch(() => null);
  if (!message) {
    await interaction.reply({ content: "Could not find that message.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (message.author.id !== client.user.id) {
    await interaction.reply({ content: "I can only edit my own messages.", flags: MessageFlags.Ephemeral });
    return;
  }

  await message.edit({ content: interaction.options.getString("content") });
  await interaction.reply({
    content: `Edited: https://discord.com/channels/${interaction.guildId}/${ref.channelId}/${ref.messageId}`,
    flags: MessageFlags.Ephemeral,
  });
}
