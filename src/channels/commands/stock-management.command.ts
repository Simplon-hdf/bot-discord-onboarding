import {
  SlashCommandBuilder,
  CommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
  GuildMember,
} from "discord.js";
import { logger } from "../../config/logger";
import { PermissionService } from "../../common/services/permission.service";
import { InteractionResponseUtil } from "../../common/utils/interaction-response.util";

export const data = new SlashCommandBuilder()
  .setName("stock-management-form")
  .setDescription("Display the stock management form");

export async function execute(interaction: CommandInteraction) {
  try {
    // Vérification des permissions avec notre service centralisé
    const member = interaction.member as GuildMember;
    const permissionResult = PermissionService.checkChannelManagementPermissions(member);
    
    if (!permissionResult.hasPermission) {
      await interaction.reply({
        content: '❌ Vous n\'avez pas les permissions nécessaires pour gérer les channels.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Log de l'utilisation avec le rôle qui a donné l'autorisation
    logger.info({
      userId: member.id,
      username: member.user.username,
      matchingRole: permissionResult.matchingRole,
      command: 'stock-management-form'
    }, 'Commande stock-management-form exécutée');

    // Création de l'embed
    const embed = new EmbedBuilder()
      .setTitle("🏫 Gestion de la catégorie stock")
      .setDescription(
        "Utilisez ce formulaire pour gérer le stock de channels et de posts de Simplon HdF."
      )
      .addFields({
        name: "Instructions",
        value:
          "1. Selectionner entre gérer les channels vocaux ou gérer des posts d'un forum en particulier.\n2. Utilisez les boutons ci-dessous pour gérer le stock choisi.\n3. Les modifications sont immédiates et irréversibles.",
      })
      .setColor("#FF0000")
      .setFooter({ text: "Bot de gestion du stock • v1.0" });

    const categoryId = process.env.STOCK_ID; // ID de la catégorie stock
    logger.debug(`📌 Category ID utilisé pour le filtrage: ${categoryId}`);

    // Récupérer tous les forums de la catégorie stock
    const channels = await interaction.guild!.channels.fetch(); // Force la récupération

    logger.debug(`📌 Channels récupérés (${channels.size}) :`, channels.map(c => `${c!.name} (${c!.type})`));

    const forums = channels.filter(
      (channel) =>
        channel!.parentId === categoryId &&
        channel!.type === ChannelType.GuildForum
    );

    logger.debug(`📌 Forums trouvés (${forums.size}) :`, forums.map(f => f!.name));

    // Construire la liste des options du menu déroulant
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select-management-target")
      .setPlaceholder("Sélectionne ce que tu veux gérer")
      .addOptions([
        { label: "Gestion des channels vocaux", value: "channel-vocal" },
        ...forums.map((forum) => ({
          label: `Gestion du forum: ${forum!.name}`,
          value: `forum-${forum!.id}`,
        })),
      ]);

    const rowMenu =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    // Création des boutons
    const createButton = new ButtonBuilder()
      .setCustomId("show-create-modal")
      .setLabel("Créer")
      .setStyle(ButtonStyle.Success)
      .setEmoji("➕");

    const modifyButton = new ButtonBuilder()
      .setCustomId("show-modify-channel")
      .setLabel("Modifier")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("✏️");

    const deleteButton = new ButtonBuilder()
      .setCustomId("show-delete-channel")
      .setLabel("Supprimer")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️");

    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      createButton,
      modifyButton,
      deleteButton
    );

    // Envoi du message avec l'embed et les boutons
    await interaction.reply({
      embeds: [embed],
      components: [rowMenu, rowButtons],
    });

    logger.info({
      userId: member.id,
      username: member.user.username,
      matchingRole: permissionResult.matchingRole,
      command: 'stock-management-form'
    }, "Formulaire de gestion de la catégorie stock affiché");

  } catch (error) {
    logger.error({
      userId: interaction.user.id,
      username: interaction.user.username,
      command: 'stock-management-form',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, "Erreur lors de l'affichage du formulaire de gestion de la catégorie stock");
    
    await interaction.reply({
      content: "❌ Une erreur est survenue lors de l'affichage du formulaire.",
      flags: MessageFlags.Ephemeral
    });
  }
}
