import { Events, EmbedBuilder, AuditLogEvent } from "discord.js";

const ACTIONS = {
  [AuditLogEvent.MemberKick]: { title: "Member Kicked", color: 0xffa500 },
  [AuditLogEvent.MemberBanAdd]: { title: "Member Banned", color: 0xed4245 },
  [AuditLogEvent.MemberBanRemove]: { title: "Member Unbanned", color: 0x57f287 },
};

export function setupModLog(client, config) {
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    if (config.guildId && guild.id !== config.guildId) return;
    const action = ACTIONS[entry.action];
    if (!action) return;

    try {
      const target = await resolveUser(client, entry.targetId);
      const executor = await resolveUser(client, entry.executorId);

      const embed = new EmbedBuilder()
        .setTitle(action.title)
        .setColor(action.color)
        .addFields(
          { name: "User", value: target ? `${target.tag ?? target.username} (${target.id})` : String(entry.targetId ?? "unknown") },
          { name: "Moderator", value: executor ? `${executor.tag ?? executor.username} (${executor.id})` : String(entry.executorId ?? "unknown") },
          { name: "Reason", value: entry.reason || "No reason provided" }
        )
        .setTimestamp(new Date());

      if (target) embed.setThumbnail(target.displayAvatarURL());
      await sendLog(guild, config.logChannelId, embed);
    } catch (err) {
      console.error("audit log handling error", err);
    }
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (config.guildId && newMember.guild.id !== config.guildId) return;

    const oldTs = oldMember.communicationDisabledUntilTimestamp;
    const newTs = newMember.communicationDisabledUntilTimestamp;
    if (oldTs === newTs) return;

    const isTimeout = Boolean(newTs) && newTs > Date.now();

    try {
      const details = await findTimeoutEntry(newMember.guild, newMember.id);
      const executor = details ? await resolveUser(client, details.executorId) : null;

      const embed = new EmbedBuilder()
        .setTitle(isTimeout ? "Member Timed Out" : "Timeout Removed")
        .setColor(isTimeout ? 0xfee75c : 0x57f287)
        .addFields(
          { name: "User", value: `${newMember.user.tag ?? newMember.user.username} (${newMember.id})` },
          { name: "Moderator", value: executor ? `${executor.tag ?? executor.username} (${executor.id})` : "Unknown" },
          { name: "Duration", value: isTimeout ? `<t:${Math.floor(newTs / 1000)}:R>` : "Removed" },
          { name: "Reason", value: (details && details.reason) || "No reason provided" }
        )
        .setTimestamp(new Date())
        .setThumbnail(newMember.user.displayAvatarURL());

      await sendLog(newMember.guild, config.logChannelId, embed);
    } catch (err) {
      console.error("timeout handling error", err);
    }
  });
}

async function resolveUser(client, id) {
  if (!id) return null;
  try {
    return await client.users.fetch(id);
  } catch {
    return null;
  }
}

async function findTimeoutEntry(guild, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 6 });
    const now = Date.now();
    for (const entry of logs.entries.values()) {
      if (entry.targetId !== targetId) continue;
      if (now - entry.createdTimestamp > 15000) continue;
      if (entry.changes.some((c) => c.key === "communication_disabled_until")) {
        return { executorId: entry.executorId, reason: entry.reason };
      }
    }
  } catch (err) {
    console.error("fetchAuditLogs failed", err && err.message ? err.message : err);
  }
  return null;
}

async function sendLog(guild, channelId, embed) {
  if (!channelId) return;
  try {
    const channel = await guild.channels.fetch(channelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("send log failed", err && err.message ? err.message : err);
  }
}
