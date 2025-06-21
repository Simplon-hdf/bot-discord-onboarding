import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  MessageFlags
} from "discord.js";

export class InteractionResponseUtil {
  /**
   * Envoie une réponse d'erreur de permissions à l'utilisateur
   */
  static async sendPermissionDeniedResponse(
    interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction
  ): Promise<void> {
    const content = '❌ Vous n\'avez pas les permissions nécessaires pour gérer les channels.';
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content,
        flags: MessageFlags.Ephemeral
      });
    } else if (interaction.deferred) {
      await interaction.followUp({
        content,
        ephemeral: true
      });
    }
  }

  /**
   * Envoie une réponse d'erreur générique
   */
  static async sendErrorResponse(
    interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
    message: string = "❌ Une erreur est survenue."
  ): Promise<void> {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral
      });
    } else if (interaction.deferred) {
      await interaction.followUp({
        content: message,
        ephemeral: true
      });
    }
  }
} 