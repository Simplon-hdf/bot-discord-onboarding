import {
  Interaction,
  Client,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

import { logger } from "../config/logger";

// Import des commandes campus
import { execute as executeCreateCampus } from "../campuses/commands/create-campus.command";
import { execute as executeModifyCampus } from "../campuses/commands/modify-campus.command";
import { execute as executeDeleteCampus } from "../campuses/commands/delete-campus.command";
import { execute as executeShowCampusForm } from "../campuses/commands/show-campus-form.command";
import { execute as executeSetupIdentification } from "../identification_requests/commands/setupIdentificationButton";

// Import des commandes stock-post

import { execute as executeStockManagementForm } from "../channels/commands/stock-management.command";
import { StockManagementHandler } from "../channels/events/channels-interaction.handler";

// Gestionnaire d'événements campus
import { execute as executeCreateCourse } from "../courses/commands/create-course.command";
import { execute as executeDeleteCourse } from "../courses/commands/delete-course.command";
import { execute as executeShowCourseForm } from "../courses/commands/show-course-form.command";
import { CampusInteractionsHandler } from "../campuses/events/campus-interactions.handler";
import { PromotionCreationHandler } from "../promotions/events/promotion-creation.handler";
import { PromotionModalHandler } from "../promotions/events/promotion-modal.handler";
import { execute as executeCreatePromo } from "../promotions/commands/create-promo.command";
import { CourseInteractionsHandler } from "../courses/events/course-interactions.handler";

export class InteractionHandler {
  private campusInteractions: CampusInteractionsHandler;
  private promotionCreation: PromotionCreationHandler;
  private promotionModal: PromotionModalHandler;
  private courseInteractions: CourseInteractionsHandler;
  private stockManagement: StockManagementHandler;

  constructor(client: Client) {
    this.campusInteractions = new CampusInteractionsHandler();
    this.promotionCreation = new PromotionCreationHandler(client);
    this.promotionModal = new PromotionModalHandler();
    this.courseInteractions = new CourseInteractionsHandler(client);
    this.stockManagement = new StockManagementHandler(
      client,
      client.guilds.cache.first()!
    );
  }

  async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (
        interaction.isModalSubmit() ||
        interaction.isStringSelectMenu() ||
        interaction.isButton()
      ) {
        logger.info(`📝 Interaction détectée : ${interaction.customId}`);
        if (
          interaction.customId === "show-create-modal" ||
          interaction.customId === "show-modify-channel" ||
          interaction.customId === "show-delete-channel" ||
          interaction.customId === "select-stock-channel-update" ||
          interaction.customId === "select-stock-channel-delete" ||
          interaction.customId === "select-management-target" || // Ajout de la gestion du menu déroulant
          interaction.customId.startsWith("update-stock-post-") ||
          interaction.customId === "create-stock-post"
        ) {
          await this.stockManagement.handleInteraction(interaction);
          return;
        }
        if (interaction.isModalSubmit()) {
          if (interaction.customId === "promotion-name-modal") {
            await this.promotionCreation.handlePromotionNameSubmission(
              interaction
            );
            return;
          }
          if (interaction.customId === "identification-form") {
            const { execute } = await import(
              "../identification_requests/events/handleIdentificationForm"
            );
            await execute(interaction);
            return;
          }
          if (interaction.customId === "create-course-modal-from-slash") {
            await this.courseInteractions.handleModalSubmit(interaction);
            return;
          }
          if (interaction.customId === "identification-form") {
            const { execute } = await import(
              "../identification_requests/events/handleIdentificationForm"
            );
            await execute(interaction);
            return;
          }
          if (interaction.customId === "create-course-modal-from-slash") {
            await this.courseInteractions.handleModalSubmit(interaction);
            return;
          }
          await this.campusInteractions.handleModalSubmit(interaction);
          return;
        }

        if (interaction.isStringSelectMenu()) {
          if (interaction.customId.startsWith("role-select-")) {
            const { execute } = await import(
              "../identification_requests/events/handleRoleSelection"
            );
            await execute(interaction);
            return;
          }
          if (
            interaction.customId === "certification_select" ||
            interaction.customId === "stock_select" ||
            interaction.customId === "delete-course-select"
          ) {
            await this.courseInteractions.handleSelectMenu(interaction);
            return;
          }
          if (interaction.customId === "select-campus-for-promo") {
            await this.promotionCreation.handleCampusSelection(interaction);
            return;
          }
          if (interaction.customId === "select-template-forum") {
            await this.promotionCreation.handleTemplateSelection(interaction);
            return;
          }
          if (interaction.customId === "select-specific-posts") {
            await this.promotionCreation.handleSpecificPostsSelection(
              interaction
            );
            return;
          }
          logger.debug(`🔘 Bouton détecté : ${interaction.customId}`);
          await this.campusInteractions.handleSelectMenu(interaction);
        } else if (interaction.isButton()) {
          if (interaction.customId === "request-identification") {
            // Gérer le bouton d'identification
            const { execute } = await import(
              "../identification_requests/events/handleIdentificationButton"
            );
            await execute(interaction);
            return;
          } else if (interaction.customId.startsWith("rgpd-accept-")) {
            const { execute } = await import(
              "../identification_requests/events/handleRGPDAcceptance"
            );
            await execute(interaction);
            return;
          } else if (interaction.customId.startsWith("rules-accept-")) {
            const { execute } = await import(
              "../identification_requests/events/handleRulesAcceptance"
            );
            await execute(interaction);
            return;
          }
          if (interaction.customId === "enter-promotion-name") {
            await this.promotionModal.handlePromotionNameButton(interaction);
            return;
          }
          if (interaction.customId === "finish-promotion-creation") {
            await this.promotionCreation.finishPromotionCreation(interaction);
            return;
          }
          if (interaction.customId === "cancel-promotion-creation") {
            await this.promotionCreation.cancelPromotionCreation(interaction);
            return;
          } else if (
            interaction.customId === "show-create-course" ||
            interaction.customId === "show-delete-course" ||
            interaction.customId === "validate_stock" ||
            interaction.customId === "add_more_stock" ||
            interaction.customId === "confirm-delete-course" ||
            interaction.customId === "cancel-delete-course"
          ) {
            await this.courseInteractions.handleButton(interaction);
            return;
          }
          logger.debug(`🔘 Bouton détecté : ${interaction.customId}`);
          await this.campusInteractions.handleButton(interaction);
          return;
          // } catch (handlerError) {
          //     logger.error(`❌ Erreur dans l'exécution de l'interaction ${interaction.customId}`, { error: handlerError });
          //     await interaction.reply({
          //         content: '❌ Une erreur interne est survenue lors du traitement de votre action.',
          //         flags: MessageFlags.Ephemeral
          //     });
          //     return;
          // }
        }
      }
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      }
    } catch (error) {
      logger.error(error, "❌ Erreur critique dans handleInteraction()");

      if (
        interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        try {
          await interaction.reply({
            content:
              "❌ Une erreur critique est survenue lors du traitement de l'interaction.",
            flags: MessageFlags.Ephemeral,
          });
        } catch (replyError) {
          logger.error(
            replyError,
            "❌ Impossible d'envoyer le message d'erreur"
          );
        }
      }
    }
  }

  private async handleSlashCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const { commandName } = interaction;

    logger.debug(
      {
        command: commandName,
        user: interaction.user.tag,
      },
      "🚀 Commande slash reçue"
    );

    try {
      switch (commandName) {
        // Gestion des campus
        case "course-form":
          await executeShowCourseForm(interaction);
          break;
        case "create-campus":
          await executeCreateCampus(interaction);
          break;
        case "modify-campus":
          await executeModifyCampus(interaction);
          break;
        case "delete-campus":
          await executeDeleteCampus(interaction);
          break;
        case "campus-form":
          await executeShowCampusForm(interaction);
          break;
        case "setup-identification":
          await executeSetupIdentification(interaction);
          break;
        case "stock-management-form":
          await executeStockManagementForm(interaction);
          break;
        case "create-promo":
          await executeCreatePromo(interaction);
          break;

        case "create-course":
          await executeCreateCourse(interaction);
          break;
        case "delete-course":
          await executeDeleteCourse(interaction);
          break;
        default:
          if (!interaction.replied && !interaction.deferred) {
            logger.warn(`⚠️ Commande inconnue : ${commandName}`);
            await interaction.reply({
              content: "❌ Commande inconnue.",
              flags: MessageFlags.Ephemeral,
            });
          }
      }
    } catch (error) {
      logger.error(
        error,
        `❌ Erreur lors de l'exécution de la commande : ${commandName}`
      );
      throw error;
    }
  }
}
