import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from "discord.js";
import { logger } from "../../../config/logger";
import { ChannelService } from "../../services/channels-service";
import { InputSanitizer } from "../../../utils/input-sanitizer";

export class StockChannelCreator {
  private channelService: ChannelService;

  constructor(channelService: ChannelService) {
    this.channelService = channelService;
  }

  async showCreateChannelModal(interaction: ButtonInteraction) {
    try {
        logger.debug(`📌 DEBUG: Affichage du modal de création de channel pour ${interaction.user.tag}`);

        const modal = new ModalBuilder()
            .setCustomId("create-stock-post")
            .setTitle("Créer un nouveau channel");

        const nameInput = new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Nom du channel")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const typeChoice = new TextInputBuilder()
            .setCustomId("type")
            .setLabel("Type (text/voice)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const positionInput = new TextInputBuilder()
            .setCustomId("position")
            .setLabel("Position")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(typeChoice),
            new ActionRowBuilder<TextInputBuilder>().addComponents(positionInput)
        );

        await interaction.showModal(modal);
        logger.debug(`✅ Modal affiché avec succès`);
    } catch (error) {
        logger.error("❌ Erreur lors de l'affichage du modal de création", error);
        if (!interaction.replied) {
            await interaction.reply({
                content: "❌ Une erreur est survenue lors de l'affichage du formulaire.",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}


  async handleCreateStockPost(interaction: ModalSubmitInteraction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Récupération des valeurs brutes du formulaire
      const rawName = interaction.fields.getTextInputValue("name");
      const rawType = interaction.fields.getTextInputValue("type");
      const rawPosition = interaction.fields.getTextInputValue("position");

      // ID de l'utilisateur Discord pour le rate limiting
      const discordUserId = interaction.user.id;

      logger.info(
        `📥 Tentative de création du channel : rawName=${rawName}, rawType=${rawType}, rawPosition=${rawPosition}, userId=${discordUserId}`
      );

      // ✅ SANITISATION ET VALIDATION des champs
      const sanitizationResult = InputSanitizer.sanitizeChannelForm(
        rawName,
        rawType,
        rawPosition
      );

      // Si la sanitisation a échoué, on renvoie les erreurs
      if (!sanitizationResult.isValid) {
        const errorMessage = `❌ Données invalides :\n${sanitizationResult.errors.join('\n')}`;
        logger.warn(`❌ Validation échouée pour ${discordUserId}: ${sanitizationResult.errors.join(', ')}`);
        
        await interaction.editReply({
          content: errorMessage,
        });
        return;
      }

      // Utilisation des données sanitisées
      const { name, type, position } = sanitizationResult.sanitizedData;

      logger.info(
        `✅ Données sanitisées : name=${name}, type=${type}, position=${position}, userId=${discordUserId}`
      );

      // Création du channel avec les données sanitisées
      const newChannel = await this.channelService.createDiscordChannel(
        name,
        type,
        position,
        discordUserId
      );
      
      logger.info(`✅ Channel créé : ${newChannel.id}`);

      await interaction.editReply({
        content: `✅ Channel "${name}" créé avec succès !`,
      });
    } catch (error) {
      logger.error("❌ Erreur lors de la création du channel :", error);
      if (!interaction.replied) {
        await interaction.editReply({
          content: "❌ Une erreur est survenue lors de la création du channel.",
        });
      }
    }
  }
}
