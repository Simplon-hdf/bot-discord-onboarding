import {
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  ButtonInteraction,
  StringSelectMenuBuilder,
} from "discord.js";
import { logger } from "../../../config/logger";
import { ChannelService } from "../../services/channels-service";
import { InputSanitizer } from "../../../utils/input-sanitizer";

export class StockChannelModifier {
  private channelService: ChannelService;

  constructor(channelService: ChannelService) {
    this.channelService = channelService;
  }

  async showModifyChannelSelection(interaction: ButtonInteraction) {
    logger.info(`🔍 DEBUG: Début de showModifyChannelSelection`);

    // Assurer que la guild est bien récupérée
    if (!interaction.guild) {
      logger.error("❌ Impossible de récupérer la guild depuis l'interaction.");
      return interaction.reply({
        content: "❌ Erreur : impossible de récupérer la guild.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const channels = await this.channelService.getStockChannels();

    // Convertir en tableau au cas où
    const channelsArray = Array.isArray(channels)
      ? channels
      : Array.from(channels.values()).filter((c) => c !== null);

    logger.info(
      `🔍 Channels récupérés : ${JSON.stringify(
        channelsArray.map((c) => c!.name)
      )}`
    );

    if (!channelsArray.length) {
      logger.error("❌ Aucun channel trouvé pour modification.");
      return interaction.reply({
        content: "❌ Aucun channel trouvé.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-stock-channel-update")
      .setPlaceholder("Sélectionne un channel")
      .addOptions(
        channelsArray.map((channel) => ({
          label: channel!.name,
          value: channel!.id,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    logger.info(`✅ Menu de sélection créé.`);

    await interaction.reply({
      content: "✏️ Sélectionne un channel à modifier :",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  async handleSelectMenu(interaction: StringSelectMenuInteraction) {
    logger.info(
      `🔍 DEBUG: Début de handleSelectMenu → Interaction ID: ${interaction.customId}`
    );

    if (interaction.customId !== "select-stock-channel-update") {
      logger.warn(`⚠️ Interaction ignorée : ${interaction.customId}`);
      return;
    }

    const channelId = interaction.values[0];
    logger.info(`🔍 Channel sélectionné pour modification : ${channelId}`);

    const modal = new ModalBuilder()
      .setCustomId(`update-stock-post-${channelId}`)
      .setTitle("Modifier le channel");

    const nameInput = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("Nouveau nom du channel")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const positionInput = new TextInputBuilder()
      .setCustomId("position")
      .setLabel("Nouvelle position")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(positionInput)
    );

    await interaction.showModal(modal);
    logger.info(`✅ Modal de modification affiché.`);
  }

  async handleModifyModalSubmit(interaction: ModalSubmitInteraction) {
    logger.info(
      `🔍 DEBUG: Début de handleModalSubmit → Interaction ID: ${interaction.customId}`
    );

    if (!interaction.customId.startsWith("update-stock-post-")) {
      logger.warn(`⚠️ Interaction ignorée : ${interaction.customId}`);
      return;
    }

    const channelId = interaction.customId.replace("update-stock-post-", "");
    // 🔍 ID de l'utilisateur Discord pour le rate limiting
    const discordUserId = interaction.user.id;
    
    logger.info(`🔍 Mise à jour du channel ${channelId} par l'utilisateur ${discordUserId}`);

    // Récupération des valeurs brutes du formulaire
    const rawNewName = interaction.fields.getTextInputValue("name");
    const rawNewPosition = interaction.fields.getTextInputValue("position");

    logger.info(
      `📥 Valeurs brutes reçues → Nom: "${rawNewName || "inchangé"}", Position: "${rawNewPosition || "inchangée"}"`
    );

    // ✅ SANITISATION ET VALIDATION des champs (uniquement s'ils sont fournis)
    const sanitizationErrors: string[] = [];
    let sanitizedName: string | undefined;
    let sanitizedPosition: number | undefined;

    // Sanitisation du nom (seulement si fourni)
    if (rawNewName && rawNewName.trim()) {
      const nameResult = InputSanitizer.sanitizeChannelName(rawNewName);
      if (nameResult.isValid) {
        sanitizedName = nameResult.value as string;
        logger.info(`✅ Nom sanitisé : "${rawNewName}" → "${sanitizedName}"`);
      } else {
        sanitizationErrors.push(...nameResult.errors);
        logger.warn(`❌ Erreurs nom : ${nameResult.errors.join(', ')}`);
      }
    }

    // Sanitisation de la position (seulement si fournie)
    if (rawNewPosition && rawNewPosition.trim()) {
      const positionResult = InputSanitizer.sanitizeChannelPosition(rawNewPosition);
      if (positionResult.isValid) {
        sanitizedPosition = positionResult.value as number;
        logger.info(`✅ Position sanitisée : "${rawNewPosition}" → ${sanitizedPosition}`);
      } else {
        sanitizationErrors.push(...positionResult.errors);
        logger.warn(`❌ Erreurs position : ${positionResult.errors.join(', ')}`);
      }
    }

    // Si des erreurs de sanitisation, on les affiche
    if (sanitizationErrors.length > 0) {
      const errorMessage = `❌ Données invalides :\n${sanitizationErrors.join('\n')}`;
      logger.warn(`❌ Validation échouée pour ${discordUserId}: ${sanitizationErrors.join(', ')}`);
      
      await interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Si aucun champ fourni, on informe l'utilisateur
    if (!sanitizedName && sanitizedPosition === undefined) {
      await interaction.reply({
        content: "❌ Aucune modification fournie. Veuillez remplir au moins un champ.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    logger.info(
      `✅ Données finales sanitisées → Nom: ${sanitizedName || "inchangé"}, Position: ${sanitizedPosition ?? "inchangée"}`
    );

    const guild = interaction.guild;
    if (!guild) {
      logger.error("❌ Impossible de récupérer la guild.");
      await interaction.reply({
        content: "❌ Erreur : impossible de récupérer la guild.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = await guild.channels.fetch(channelId);
    if (!channel) {
      logger.error(`❌ Channel non trouvé avec l'ID ${channelId}`);
      await interaction.reply({
        content: "❌ Channel introuvable.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    logger.info(`✅ Channel trouvé : ${channel.name}`);

    // Mise à jour du channel sur Discord avec les données sanitisées
    const updatedChannel = await channel.edit({
      name: sanitizedName || channel.name,
      position: sanitizedPosition !== undefined
        ? sanitizedPosition
        : "position" in channel
        ? channel.position
        : undefined,
    });

    logger.info(
      `✅ Channel mis à jour sur Discord → Nom: ${
        updatedChannel.name
      }, Position: ${
        "position" in updatedChannel ? updatedChannel.position : "inchangée"
      }`
    );

    logger.info(
      `📡 Envoi de la requête API pour la mise à jour du channel : ${channelId}`
    );
    logger.info(
      `📡 Données envoyées : ${JSON.stringify({
        name: sanitizedName || undefined,
        channelPosition: sanitizedPosition || undefined,
      })}`
    );

    try {
      logger.info(
        `🔍 Appel à updateDiscordChannel pour le channel ${channelId}`
      );
      // ✅ Passer l'ID utilisateur pour le rate limiting par utilisateur Discord
      await this.channelService.updateDiscordChannel(channelId, {
        name: sanitizedName || undefined,
        channelPosition: sanitizedPosition || undefined,
      }, discordUserId);  // ← ID de l'utilisateur pour le rate limiting

      logger.info(
        `✅ Mise à jour en base réussie pour le channel ${updatedChannel.name}`
      );
    } catch (error) {
      logger.error(
        `❌ Erreur lors de la mise à jour du channel en base :`,
        error
      );
    }

    await interaction.reply({
      content: `✅ Channel "${updatedChannel.name}" mis à jour avec succès !`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
