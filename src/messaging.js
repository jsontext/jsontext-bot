import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, Events, MessageFlags } from "discord.js";

export const sendDefinition = new SlashCommandBuilder()
  .setName("send")
  .setDescription("Send a message as the bot")
  .addStringOption((o) => o.setName("message").setDescription("Message content").setMaxLength(2000))
  .addAttachmentOption((o) => o.setName("image").setDescription("Optional image or file"))
  .addChannelOption((o) => o.setName("channel").setDescription("Channel to send to (defaults to current)"))
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
  const content = interaction.options.getString("message") || "";
  const attachment = interaction.options.getAttachment("image");

  if (!target || !target.isTextBased()) {
    await interaction.reply({ content: "Invalid channel.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!content && !attachment) {
    await interaction.reply({ content: "Provide a message or an image.", flags: MessageFlags.Ephemeral });
    return;
  }

  const payload = {};
  if (content) payload.content = content;
  if (attachment) {
    const res = await fetch(attachment.url);
    const buffer = Buffer.from(await res.arrayBuffer());
    payload.files = [new AttachmentBuilder(buffer, { name: attachment.name })];
  }

  const sent = await target.send(payload);
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

  const raw = (interaction.options.getString("message") || "").trim();
  const ref = parseMessageRef(raw, interaction.channelId);
  console.log("edit: raw =", JSON.stringify(raw), "ref =", JSON.stringify(ref));

  if (!ref) {
    await interaction.reply({ content: "Provide a valid message link or ID.", flags: MessageFlags.Ephemeral });
    return;
  }

  let channel;
  try {
    channel = await client.channels.fetch(ref.channelId);
  } catch (err) {
    console.error("edit: channel fetch failed", err);
    await interaction.reply({
      content: `Could not access channel \`${ref.channelId}\`: ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!channel || !channel.isTextBased()) {
    await interaction.reply({ content: "Could not find that channel.", flags: MessageFlags.Ephemeral });
    return;
  }

  let message;
  try {
    message = await channel.messages.fetch(ref.messageId);
  } catch (err) {
    console.error("edit: message fetch failed", err);
    await interaction.reply({
      content: `Could not fetch message \`${ref.messageId}\` in <#${ref.channelId}>: ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (message.author.id !== client.user.id) {
    await interaction.reply({ content: "I can only edit my own messages.", flags: MessageFlags.Ephemeral });
    return;
  }

  const newContent = interaction.options.getString("content");
  if (message.embeds.length > 0) {
    const embed = EmbedBuilder.from(message.embeds[0]).setDescription(newContent);
    await message.edit({ embeds: [embed] });
  } else {
    await message.edit({ content: newContent });
  }
  await interaction.reply({
    content: `Edited: https://discord.com/channels/${interaction.guildId}/${ref.channelId}/${ref.messageId}`,
    flags: MessageFlags.Ephemeral,
  });
}
