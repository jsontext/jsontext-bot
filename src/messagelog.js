import { Events, EmbedBuilder } from "discord.js";

const CONTENT_LIMIT = 1000;

function truncate(text, max = CONTENT_LIMIT) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function attachmentsText(message) {
  if (!message.attachments || message.attachments.size === 0) return null;
  return message.attachments.map((a) => a.url).join("\n").slice(0, CONTENT_LIMIT);
}

async function send(client, config, embed) {
  if (!config.messageLogChannelId) return;
  try {
    const channel = await client.channels.fetch(config.messageLogChannelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("message log send failed", err && err.message ? err.message : err);
  }
}

export function setupMessageLog(client, config) {
  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guild) return;
      if (message.author && message.author.bot) return;

      const embed = new EmbedBuilder()
        .setTitle("Message Deleted")
        .setColor(0xed4245)
        .addFields(
          { name: "Author", value: message.author ? `${message.author.tag ?? message.author.username} (${message.author.id})` : "Unknown (uncached)" },
          { name: "Channel", value: message.channel ? `<#${message.channel.id}>` : "Unknown" },
          { name: "Content", value: truncate(message.content) || "*(no text / not cached)*" }
        )
        .setFooter({ text: `Message ID: ${message.id}` })
        .setTimestamp(new Date());

      const att = attachmentsText(message);
      if (att) embed.addFields({ name: "Attachments", value: att });
      if (message.author) embed.setThumbnail(message.author.displayAvatarURL());

      await send(client, config, embed);
    } catch (err) {
      console.error("messageDelete error", err);
    }
  });

  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    try {
      if (!channel.guild) return;
      const list = [...messages.values()]
        .filter((m) => !(m.author && m.author.bot))
        .slice(0, 15)
        .map((m) => `**${m.author ? m.author.tag ?? m.author.username : "unknown"}:** ${truncate(m.content, 120) || "*(no text)*"}`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle("Messages Bulk Deleted")
        .setColor(0xed4245)
        .addFields(
          { name: "Channel", value: `<#${channel.id}>` },
          { name: "Count", value: String(messages.size) },
          { name: "Messages", value: list || "*(none)*" }
        )
        .setTimestamp(new Date());

      await send(client, config, embed);
    } catch (err) {
      console.error("messageBulkDelete error", err);
    }
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
      if (!newMessage.guild) return;
      if (newMessage.author && newMessage.author.bot) return;

      const oldContent = oldMessage.partial ? null : oldMessage.content;
      const newContent = newMessage.content;
      if (oldContent === newContent) return;
      if (!oldContent && !newContent) return;

      const embed = new EmbedBuilder()
        .setTitle("Message Edited")
        .setColor(0xfee75c)
        .addFields(
          { name: "Author", value: newMessage.author ? `${newMessage.author.tag ?? newMessage.author.username} (${newMessage.author.id})` : "Unknown" },
          { name: "Channel", value: `<#${newMessage.channel.id}>` },
          { name: "Before", value: truncate(oldContent) || "*(not cached)*" },
          { name: "After", value: truncate(newContent) || "*(empty)*" }
        )
        .setURL(newMessage.url)
        .setFooter({ text: `Message ID: ${newMessage.id}` })
        .setTimestamp(new Date());

      await send(client, config, embed);
    } catch (err) {
      console.error("messageUpdate error", err);
    }
  });
}
