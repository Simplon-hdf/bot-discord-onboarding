import {
    CommandInteraction,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    GuildMember
} from 'discord.js';
import { logger } from '../../config/logger';

const AUTHORIZED_ROLES = ['Administrateur', 'Directeur', 'CDP'];

async function checkUserPermissions(interaction: CommandInteraction): Promise<boolean> {
    const member = interaction.member as GuildMember;
    
    if (!member) {
        logger.error('❌ Membre non trouvé');
        await interaction.reply({
            content: '❌ Membre non trouvé',
            ephemeral: true
        });
        return false;
    }

    const hasRequiredRole = member.roles.cache.some(role => 
        AUTHORIZED_ROLES.includes(role.name)
    );

    if (!hasRequiredRole) {
        await interaction.reply({
            content: '❌ Vous n\'avez pas les permissions nécessaires pour créer une formation.',
            ephemeral: true
        });
        
        logger.warn({
            userId: member.id,
            userRoles: member.roles.cache.map(r => r.name),
            action: 'create_course_unauthorized'
        }, 'Tentative de création de formation non autorisée');
        
        return false;
    }

    return true;
}

export const data = new SlashCommandBuilder()
    .setName('create-course')
    .setDescription('Créer une nouvelle formation');

export async function execute(interaction: CommandInteraction) {    
    try {   
        const authorized = await checkUserPermissions(interaction);
        if (!authorized) {
            return;
        }
        
        const guild = interaction.guild;
        if (!guild) {
            throw new Error('Guild not found');
        }

        const modal = new ModalBuilder()
            .setCustomId('create-course-modal-from-slash')
            .setTitle('Créer une nouvelle formation');

        const nameInput = new TextInputBuilder()
            .setCustomId('courseName')
            .setLabel('Nom de la formation')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: Développeur web')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(50);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>()
            .addComponents(nameInput);

        modal.addComponents(firstActionRow);

        return await interaction.showModal(modal);

    } catch (error) {
        logger.error(error, '❌ Erreur lors de la création de la modale de formation');
        await interaction.reply({
            content: '❌ Une erreur est survenue lors de la création du formulaire.',
            ephemeral: true
        });
    }
} 