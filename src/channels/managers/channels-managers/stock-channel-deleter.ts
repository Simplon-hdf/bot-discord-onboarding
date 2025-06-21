import {
  StringSelectMenuInteraction,
  MessageFlags,
  ButtonInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from "discord.js";
import { logger } from "../../../config/logger";
import { ChannelService } from "../../services/channels-service";

export class StockChannelDeleter {
  private channelService: ChannelService;

  constructor(channelService: ChannelService) {
    this.channelService = channelService;
  }

  async showDeleteChannelSelection(interaction: ButtonInteraction) {
    logger.info(`🔍 DEBUG: Début de showDeleteChannelSelection`);

    if (!interaction.guild) {
      logger.error("❌ Impossible de récupérer la guild depuis l'interaction.");
      return interaction.reply({
        content: "❌ Erreur : impossible de récupérer la guild.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const channels = await this.channelService.getStockChannels();
    const channelsArray = Array.isArray(channels)
      ? channels
      : Array.from(channels.values()).filter((c) => c !== null);

    logger.info(
      `🔍 Channels récupérés pour suppression : ${JSON.stringify(
        channelsArray.map((c) => c!.name)
      )}`
    );

    if (!channelsArray.length) {
      logger.error("❌ Aucun channel trouvé pour suppression.");
      return interaction.reply({
        content: "❌ Aucun channel trouvé.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-stock-channel-delete")
      .setPlaceholder("Sélectionne un channel à supprimer")
      .addOptions(
        channelsArray.map((channel) => ({
          label: channel!.name,
          value: channel!.id,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    logger.info(`✅ Menu de sélection pour suppression créé.`);

    await interaction.reply({
      content: "🗑️ Sélectionne un channel à supprimer :",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  async handleDeleteChannelSelection(interaction: StringSelectMenuInteraction) {
    logger.info(`🔍 DEBUG: Début de handleDeleteChannelSelection`);

    const channelId = interaction.values[0];
    const discordUserId = interaction.user.id;
    
    logger.info(`🔍 Channel sélectionné pour suppression : ${channelId} par l'utilisateur ${discordUserId}`);

    if (!interaction.guild) {
      logger.error("❌ Impossible de récupérer la guild.");
      return interaction.reply({
        content: "❌ Erreur : impossible de récupérer la guild.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel) {
      logger.error(`❌ Channel non trouvé avec l'ID ${channelId}`);
      return interaction.reply({
        content: "❌ Channel introuvable.",
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await channel.delete();
      logger.info(`✅ Channel supprimé : ${channelId}`);

      await this.channelService.deleteDiscordChannel(channelId, discordUserId);

      await interaction.reply({
        content: `✅ Le channel a été supprimé avec succès !`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error(`❌ Erreur lors de la suppression du channel :`, error);
      await interaction.reply({
        content:
          "❌ Une erreur est survenue lors de la suppression du channel.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
