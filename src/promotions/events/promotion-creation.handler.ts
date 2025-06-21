import { 
    StringSelectMenuInteraction, 
    ButtonInteraction, 
    ModalSubmitInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    TextChannel,
    ForumChannel,
    Client,
    CategoryChannel,
    GuildBasedChannel,
    ThreadChannel,
    Collection,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { logger } from '../../config/logger';

interface PromotionCreationState {
    campusId: string | null;
    templateForumId: string | null;
    promotionName: string | null;
    selectedSpecificPosts: string[];
}

export class PromotionCreationHandler {
    private states: Map<string, PromotionCreationState>;
    private client: Client;
    private readonly TEMPLATE_CATEGORY_ID = '1344811915301490748';
    private readonly GENERIC_POSTS_FORUM_ID = '1347604245972779139';
    private readonly SPECIFIC_POSTS_FORUM_ID = '1347604413728030821';
    private readonly ITEMS_PER_PAGE = 20;

    constructor(client: Client) {
        this.client = client;
        this.states = new Map();
    }

    private getState(userId: string): PromotionCreationState {
        if (!this.states.has(userId)) {
            this.states.set(userId, {
                campusId: null,
                templateForumId: null,
                promotionName: null,
                selectedSpecificPosts: []
            });
        }
        return this.states.get(userId)!;
    }

    async handleCampusSelection(interaction: StringSelectMenuInteraction) {
        try {
            const state = this.getState(interaction.user.id);
            state.campusId = interaction.values[0];

            // Récupération des forums templates
            const category = await this.client.channels.fetch(this.TEMPLATE_CATEGORY_ID) as CategoryChannel;
            if (!category || category.type !== ChannelType.GuildCategory) {
                throw new Error('Catégorie de templates non trouvée');
            }

            const templateForums = category.children.cache.filter((channel: GuildBasedChannel) => 
                channel.type === ChannelType.GuildForum
            );

            if (templateForums.size === 0) {
                throw new Error('Aucun forum template trouvé');
            }

            // Création du menu de sélection des templates
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select-template-forum')
                .setPlaceholder('Sélectionnez un template de formation')
                .addOptions(
                    Array.from(templateForums.values()).slice(0, this.ITEMS_PER_PAGE).map((forum: GuildBasedChannel) => ({
                        label: forum.name,
                        value: forum.id,
                        description: `Template: ${forum.name}`
                    }))
                );

            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(selectMenu);

            // Ajout du bouton "Voir plus" si nécessaire
            const components = [row];
            if (templateForums.size > this.ITEMS_PER_PAGE) {
                const nextButton = new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('next-template-page')
                            .setPlaceholder('Plus de templates')
                            .addOptions([
                                {
                                    label: 'Page suivante',
                                    value: 'next',
                                    description: 'Voir plus de templates'
                                }
                            ])
                    );
                components.push(nextButton);
            }

            const embed = new EmbedBuilder()
                .setTitle('🎓 Création d\'une promotion - Étape 2/4')
                .setDescription('Sélectionnez le template de formation à utiliser.')
                .setColor('#FF0000')
                .setFooter({ text: 'Étape 2: Sélection du template' });

            await interaction.update({
                embeds: [embed],
                components: components
            });

            logger.info({
                user: interaction.user.tag,
                campusId: state.campusId
            }, 'Campus sélectionné pour la création de promotion');
        } catch (error) {
            logger.error(error, 'Erreur lors de la sélection du campus');
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de la sélection du campus.',
                ephemeral: true
            });
        }
    }

    async handleTemplateSelection(interaction: StringSelectMenuInteraction) {
        try {
            const state = this.getState(interaction.user.id);
            state.templateForumId = interaction.values[0];

            // Création du modal pour le nom de la promotion
            const embed = new EmbedBuilder()
                .setTitle('🎓 Création d\'une promotion - Étape 3/4')
                .setDescription('Entrez le nom de la promotion.\n\nFormat: formation-ville-pX\nExemple: cda-vals-p4')
                .setColor('#FF0000')
                .setFooter({ text: 'Étape 3: Nom de la promotion' });

            const button = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('enter-promotion-name')
                        .setLabel('Entrer le nom de la promotion')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({
                embeds: [embed],
                components: [button]
            });

            logger.info({
                user: interaction.user.tag,
                templateId: state.templateForumId
            }, 'Template sélectionné pour la création de promotion');
        } catch (error) {
            logger.error(error, 'Erreur lors de la sélection du template');
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de la sélection du template.',
                ephemeral: true
            });
        }
    }

    async handlePromotionNameSubmission(interaction: ModalSubmitInteraction) {
        try {
            const state = this.getState(interaction.user.id);
            const promotionName = interaction.fields.getTextInputValue('promotion-name');

            // Validation basique : vérifier que le nom n'est pas vide
            if (!promotionName.trim()) {
                await interaction.reply({
                    content: '❌ Le nom de la promotion ne peut pas être vide.',
                    ephemeral: true
                });
                return;
            }

            state.promotionName = promotionName;

            // Récupération des posts spécifiques
            const specificPostsForum = await this.client.channels.fetch(this.SPECIFIC_POSTS_FORUM_ID) as ForumChannel;
            if (!specificPostsForum) {
                throw new Error('Forum des posts spécifiques non trouvé');
            }

            const posts = await specificPostsForum.threads.fetch();
            const postsArray = Array.from(posts.threads.values());
            
            // Création du menu de sélection des posts spécifiques
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select-specific-posts')
                .setPlaceholder('Sélectionnez les posts spécifiques (optionnel)')
                .setMinValues(0)
                .setMaxValues(Math.min(postsArray.length, this.ITEMS_PER_PAGE))
                .addOptions(
                    postsArray.slice(0, this.ITEMS_PER_PAGE).map((post: ThreadChannel) => ({
                        label: post.name,
                        value: post.id,
                        description: `Post: ${post.name.slice(0, 50)}`
                    }))
                );

            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(selectMenu);

            // Ajout des boutons de navigation et de finalisation
            const buttons = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('finish-promotion-creation')
                        .setLabel('Terminer la création')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel-promotion-creation')
                        .setLabel('Annuler')
                        .setStyle(ButtonStyle.Danger)
                );

            const components = [row, buttons];

            const embed = new EmbedBuilder()
                .setTitle('🎓 Création d\'une promotion - Étape 4/4')
                .setDescription('Sélectionnez les posts spécifiques à ajouter (optionnel).\nLes posts génériques seront ajoutés automatiquement.')
                .setColor('#FF0000')
                .setFooter({ text: 'Étape 4: Sélection des posts spécifiques' });

            await interaction.reply({
                embeds: [embed],
                components: components,
                ephemeral: true
            });

            logger.info({
                user: interaction.user.tag,
                promotionName: state.promotionName
            }, 'Nom de promotion validé');
        } catch (error) {
            logger.error(error, 'Erreur lors de la validation du nom de promotion');
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Une erreur est survenue lors de la validation du nom.',
                    ephemeral: true
                });
            }
        }
    }

    async handleSpecificPostsSelection(interaction: StringSelectMenuInteraction) {
        try {
            const state = this.getState(interaction.user.id);
            state.selectedSpecificPosts = interaction.values;

            // Récupération des noms des posts sélectionnés
            const specificPostsForum = await this.client.channels.fetch(this.SPECIFIC_POSTS_FORUM_ID) as ForumChannel;
            if (!specificPostsForum) {
                throw new Error('Forum des posts spécifiques non trouvé');
            }

            const selectedPostsNames: string[] = [];
            for (const postId of interaction.values) {
                const post = await specificPostsForum.threads.fetch(postId);
                if (post) {
                    selectedPostsNames.push(post.name);
                }
            }

            const posts = await specificPostsForum.threads.fetch();
            const postsArray = Array.from(posts.threads.values());
            
            // Recréation du menu de sélection
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select-specific-posts')
                .setPlaceholder('Sélectionnez les posts spécifiques (optionnel)')
                .setMinValues(0)
                .setMaxValues(Math.min(postsArray.length, this.ITEMS_PER_PAGE))
                .addOptions(
                    postsArray.slice(0, this.ITEMS_PER_PAGE).map((post: ThreadChannel) => ({
                        label: post.name,
                        value: post.id,
                        description: `Post: ${post.name.slice(0, 50)}`,
                        default: state.selectedSpecificPosts.includes(post.id)
                    }))
                );

            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(selectMenu);

            // Message de confirmation avec la liste des posts sélectionnés
            let confirmationMessage = `✅ ${interaction.values.length} posts spécifiques sélectionnés :\n`;
            if (selectedPostsNames.length > 0) {
                confirmationMessage += selectedPostsNames.map(name => `• ${name}`).join('\n');
            }
            confirmationMessage += '\n\nCliquez sur "Terminer la création" pour finaliser.';

            // Boutons de finalisation
            const buttons = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('finish-promotion-creation')
                        .setLabel('Terminer la création')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel-promotion-creation')
                        .setLabel('Annuler')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.update({
                content: confirmationMessage,
                components: [row, buttons]
            });

            logger.info({
                user: interaction.user.tag,
                selectedPosts: selectedPostsNames
            }, 'Posts spécifiques sélectionnés');
        } catch (error) {
            logger.error(error, 'Erreur lors de la sélection des posts spécifiques');
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de la sélection des posts.',
                ephemeral: true
            });
        }
    }

    async finishPromotionCreation(interaction: ButtonInteraction) {
        try {
            const state = this.getState(interaction.user.id);

            // Vérification que toutes les informations nécessaires sont présentes
            if (!state.campusId || !state.templateForumId || !state.promotionName) {
                throw new Error('Informations manquantes pour la création de la promotion');
            }

            await interaction.deferReply({ ephemeral: true });

            // 1. Création du rôle pour la promotion
            const guild = interaction.guild;
            if (!guild) throw new Error('Guild non trouvée');

            const promotionNameUpper = state.promotionName.toUpperCase();

            const newRole = await guild.roles.create({
                name: promotionNameUpper,
                reason: `Rôle créé pour la promotion ${promotionNameUpper}`
            });

            logger.info({
                user: interaction.user.tag,
                roleId: newRole.id
            }, 'Rôle créé pour la promotion');

            // 2. Création de la catégorie pour la promotion
            const newCategory = await guild.channels.create({
                name: promotionNameUpper,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: newRole.id,
                        allow: ['ViewChannel']
                    }
                ]
            });

            logger.info({
                user: interaction.user.tag,
                categoryId: newCategory.id
            }, 'Catégorie créée pour la promotion');

            // 3. Création du forum de la promotion dans la nouvelle catégorie
            const templateForum = await this.client.channels.fetch(state.templateForumId) as ForumChannel;
            if (!templateForum) throw new Error('Forum template non trouvé');

            const newForum = await guild.channels.create({
                name: state.promotionName,
                type: ChannelType.GuildForum,
                parent: newCategory.id,
                position: 0,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: newRole.id,
                        allow: ['ViewChannel', 'SendMessages', 'CreatePublicThreads', 'SendMessagesInThreads']
                    }
                ]
            });

            // 4. Copie des posts du template
            const templatePosts = await templateForum.threads.fetch();
            const templatePostsArray = Array.from(templatePosts.threads.values());
            for (const post of templatePostsArray) {
                const messages = await post.messages.fetch({ limit: 100 });
                await newForum.threads.create({
                    name: post.name,
                    message: { content: messages.first()?.content || 'Contenu non disponible' }
                });
            }

            // 5. Ajout des posts génériques
            const genericPostsForum = await this.client.channels.fetch(this.GENERIC_POSTS_FORUM_ID) as ForumChannel;
            if (genericPostsForum) {
                const genericPosts = await genericPostsForum.threads.fetch();
                const genericPostsArray = Array.from(genericPosts.threads.values());
                for (const post of genericPostsArray) {
                    const messages = await post.messages.fetch({ limit: 1 });
                    await newForum.threads.create({
                        name: post.name,
                        message: { content: messages.first()?.content || 'Contenu non disponible' }
                    });
                }
            }

            // 6. Ajout des posts spécifiques sélectionnés
            if (state.selectedSpecificPosts.length > 0) {
                const specificPostsForum = await this.client.channels.fetch(this.SPECIFIC_POSTS_FORUM_ID) as ForumChannel;
                if (specificPostsForum) {
                    for (const postId of state.selectedSpecificPosts) {
                        const post = await specificPostsForum.threads.fetch(postId);
                        if (post) {
                            const messages = await post.messages.fetch({ limit: 1 });
                            await newForum.threads.create({
                                name: post.name,
                                message: { content: messages.first()?.content || 'Contenu non disponible' }
                            });
                        }
                    }
                }
            }

            // Nettoyage de l'état
            this.states.delete(interaction.user.id);

            await interaction.editReply({
                content: `✅ Promotion ${state.promotionName} créée avec succès !\nRôle créé : ${newRole.toString()}\nCatégorie et forum créés avec les permissions appropriées.`,
                components: []
            });

            logger.info({
                user: interaction.user.tag,
                promotionName: state.promotionName,
                roleId: newRole.id,
                categoryId: newCategory.id,
                forumId: newForum.id
            }, 'Promotion créée avec succès');
        } catch (error) {
            logger.error(error, 'Erreur lors de la finalisation de la création de promotion');
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de la création de la promotion.',
            });
        }
    }

    async cancelPromotionCreation(interaction: ButtonInteraction) {
        this.states.delete(interaction.user.id);
        await interaction.update({
            content: '❌ Création de promotion annulée.',
            embeds: [],
            components: []
        });
        logger.info({
            user: interaction.user.tag
        }, 'Création de promotion annulée');
    }

    async handleEnterPromotionName(interaction: ButtonInteraction) {
        try {
            const modal = new ModalBuilder()
                .setCustomId('promotion-name-modal')
                .setTitle('Nom de la promotion');

            const promotionNameInput = new TextInputBuilder()
                .setCustomId('promotion-name')
                .setLabel('Nom de la promotion')
                .setPlaceholder('Entrez le nom de la promotion')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(50);

            const firstActionRow = new ActionRowBuilder<TextInputBuilder>()
                .addComponents(promotionNameInput);

            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);

            logger.info({
                user: interaction.user.tag
            }, 'Modal de saisie du nom de promotion affiché');
        } catch (error) {
            logger.error(error, 'Erreur lors de l\'affichage du modal de saisie du nom');
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de l\'affichage du formulaire.',
                ephemeral: true
            });
        }
    }
} 