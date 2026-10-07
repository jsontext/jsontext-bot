import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, MessageFlags } from "discord.js";

export const panelDefinition = new SlashCommandBuilder()
  .setName("spawnpanel")
  .setDescription("Post the support panel with the ticket and verify buttons")
  .toJSON();

const PANEL = `## Need Support or Want to Contact Us?
-# False or troll tickets will result in moderation action! Please review the guidelines below before opening a ticket:


**User Reports & Cheating**
-# You can report users breaking server rules or exploiting in our game.
-# Always provide clear, unedited evidence (video clips of cheaters, full screenshots of chat issues). Incomplete reports cannot be processed.


**Ban Appeals**
-# State your exact Roblox username (not display name) and include a full screenshot of your ban message.
-# Explain the situation clearly. If you were caught exploiting/cheating, your ban is permanent.


**Ticket Rules**
-# Fill out all required info completely before submitting.
-# No edited or cropped evidence allowed.
-# No troll tickets, spamming, or opening tickets just to chat with specific staff members.
-# Respect staff decisions—do not argue outcomes; all decisions are final.`;

export function setupPanel(client, config) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "spawnpanel") return;

    if (config.staffRoleId && interaction.member && !interaction.member.roles.cache.has(config.staffRoleId)) {
      await interaction.reply({ content: "Only staff can post the panel.", flags: MessageFlags.Ephemeral });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket:open").setLabel("Open Ticket").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("verify:start").setLabel("Verify yourself").setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ content: PANEL, components: [row] });
  });
}
