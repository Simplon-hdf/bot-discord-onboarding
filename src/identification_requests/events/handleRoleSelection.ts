import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, Interaction } from 'discord.js';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('role-select-')) return;

    try {
        const selectedRole = interaction.values[0];
        const userId = interaction.customId.replace('role-select-', '');

        // Message RGPD
        const rgpdMessage = `**Consentement RGPD**
Conformément au RGPD,
vous êtes informé que, en validant ci-dessous, vous consentez au traitement de vos données personnelles dans le cadre de ce serveur Discord.
Ces traitements sont nécessaires notamment pour :
• Gérer votre identification sur le serveur Discord
• Vous attribuer les rôles et accès appropriés
• Vous contacter en cas de besoin

Vos droits :
• Accès à vos données personnelles
• Rectification ou suppression de vos données
• Limitation du traitement
• Opposition au traitement
• Portabilité de vos données
• Au besoin, introduire une réclamation auprès de la CNIL (www.cnil.fr).

Pour exercer ces droits ou pour toute question, contactez notre DPO.
[adresse e-mail du DPO]

Sans ce consentement, vous ne pourrez pas poursuivre l’inscription.`;

        // Création du bouton d'acceptation
        const acceptButton = new ButtonBuilder()
            .setCustomId(`rgpd-accept-${selectedRole}-${userId}`)
            .setLabel('J\'accepte ce consentement RGPD')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(acceptButton);

        // Mise à jour du message avec le texte RGPD et le bouton
        await interaction.update({
            content: rgpdMessage,
            components: [row],
        });

    } catch (error) {
        console.error('Erreur lors de la sélection du rôle:', error);
        await interaction.reply({
            content: 'Une erreur est survenue lors de la sélection du rôle.',
            ephemeral: true
        });
    }
} 