import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  Client,
  Guild,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { logger } from "../../config/logger";
import { ChannelService } from "../services/channels-service";
import { StockChannelCreator } from "../managers/channels-managers/stock-channel-creator";
import { StockChannelModifier } from "../managers/channels-managers/stock-channel-modifier";
import { StockChannelDeleter } from "../managers/channels-managers/stock-channel-deleter";
import { PermissionService } from "../../common/services/permission.service";
import { InteractionResponseUtil } from "../../common/utils/interaction-response.util";

type ChannelInteraction = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

export class StockManagementHandler {
  private readonly channelService: ChannelService;
  private readonly stockChannelCreator: StockChannelCreator;
  private readonly stockChannelModifier: StockChannelModifier;
  private readonly stockChannelDeleter: StockChannelDeleter;
  private readonly userSelections = new Map<string, string>();

  constructor(client: Client, guild: Guild) {
    this.channelService = new ChannelService(client, guild);
    this.stockChannelCreator = new StockChannelCreator(this.channelService);
    this.stockChannelModifier = new StockChannelModifier(this.channelService);
    this.stockChannelDeleter = new StockChannelDeleter(this.channelService);
  }

  /**
   * Vérifie les permissions et envoie une réponse en cas d'échec
   */
  private async checkPermissionsAndRespond(interaction: ChannelInteraction): Promise<boolean> {
    const member = interaction.member as GuildMember;
    const permissionResult = PermissionService.checkChannelManagementPermissions(member);
    
    if (!permissionResult.hasPermission) {
      await InteractionResponseUtil.sendPermissionDeniedResponse(interaction);
      return false;
    }
    
    return true;
  }

  /**
   * Gère les interactions des boutons du formulaire de gestion.
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const buttonHandlers: Record<string, () => Promise<void>> = {
      "show-create-modal": async () => {
        logger.debug(`🛠️ Appel de showCreateChannelModal() pour ${interaction.user.tag}`);
        await this.stockChannelCreator.showCreateChannelModal(interaction);
        logger.debug(`✅ showCreateChannelModal() exécuté avec succès`);
      },
      "show-modify-channel": async () => {
        await this.stockChannelModifier.showModifyChannelSelection(interaction);
      },
      "show-delete-channel": async () => {
        await this.stockChannelDeleter.showDeleteChannelSelection(interaction);
      }
    };

    const handler = buttonHandlers[interaction.customId];
    if (handler) {
      await handler();
    } else {
      logger.warn(`⚠️ Bouton non géré : ${interaction.customId}`);
    }
  }

  /**
   * Gère les interactions du menu déroulant
   */
  private async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    logger.debug(`📌 Début de handleSelectMenu → ID: ${interaction.customId}`);

    await interaction.deferUpdate(); // Prévention de "Unknown Interaction"

    const selection = interaction.values[0];
    this.userSelections.set(interaction.user.id, selection);

    logger.debug(`✅ Sélection enregistrée: ${selection} pour ${interaction.user.tag}`);

    await interaction.followUp({
      content: `✅ Tu as sélectionné **${selection.replace("forum-", "Forum ")}**. Choisis une action !`,
      ephemeral: true,
    });

    logger.debug(`✅ Réponse envoyée avec succès`);
  }

  /**
   * Gère les soumissions de modal
   */
  private async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const modalHandlers: Record<string, () => Promise<void>> = {
      "create-stock-post": async () => {
        await this.stockChannelCreator.handleCreateStockPost(interaction);
      }
    };

    // Gestion des modals avec préfixes
    if (interaction.customId.startsWith("update-stock-post-")) {
      await this.stockChannelModifier.handleModifyModalSubmit(interaction);
      return;
    }

    const handler = modalHandlers[interaction.customId];
    if (handler) {
      await handler();
    } else {
      logger.warn(`⚠️ Modal non géré : ${interaction.customId}`);
    }
  }

  /**
   * Gère les interactions de menu déroulant spécialisés
   */
  private async handleSpecializedSelectMenus(interaction: StringSelectMenuInteraction): Promise<void> {
    const selectMenuHandlers: Record<string, () => Promise<void>> = {
      "select-management-target": async () => {
        await this.handleSelectMenu(interaction);
      },
      "select-stock-channel-update": async () => {
        await this.stockChannelModifier.handleSelectMenu(interaction);
      },
      "select-stock-channel-delete": async () => {
        await this.stockChannelDeleter.handleDeleteChannelSelection(interaction);
      }
    };

    const handler = selectMenuHandlers[interaction.customId];
    if (handler) {
      await handler();
    } else {
      logger.warn(`⚠️ Menu déroulant non géré : ${interaction.customId}`);
    }
  }

  /**
   * Gère l'interaction principale pour le stock-management-form.
   */
  async handleInteraction(interaction: ChannelInteraction): Promise<void> {
    try {
      logger.info({
        customId: interaction.customId,
        userId: interaction.user.id,
        username: interaction.user.username,
        interactionType: interaction.type
      }, 'Interaction détectée');

      // Vérification globale des permissions (sauf pour certains menus qui ont leur propre logique)
      const skipPermissionCheck = [
        "select-stock-channel-update", 
        "select-stock-channel-delete"
      ].includes(interaction.customId);

      if (!skipPermissionCheck && !await this.checkPermissionsAndRespond(interaction)) {
        return;
      }

      if (interaction.isButton()) {
        logger.debug(`🔘 Bouton détecté: ${interaction.customId}`);
        await this.handleButtonInteraction(interaction);
        return;
      }

      if (interaction.isModalSubmit()) {
        logger.debug(`📝 Modal soumis: ${interaction.customId}`);
        await this.handleModalSubmit(interaction);
        return;
      }

      if (interaction.isStringSelectMenu()) {
        logger.debug(`📌 Menu déroulant détecté: ${interaction.customId}`);
        await this.handleSpecializedSelectMenus(interaction);
        return;
      }

      // Cette ligne ne devrait jamais être atteinte
      logger.warn(`⚠️ Type d'interaction non géré`);

    } catch (error) {
      logger.error({
        userId: interaction.user.id,
        username: interaction.user.username,
        interactionType: interaction.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, "❌ Erreur dans handleInteraction()");

      await InteractionResponseUtil.sendErrorResponse(interaction);
    }
  }
}
