import { ChannelType, Client, Guild, GuildChannel } from 'discord.js';
import { logger } from '../../config/logger';
import { authService } from '../../services/auth.service';

interface GuildData {
    uuid: string;
    name: string;
    memberCount: string;
    configuration: {};
}

interface CategoryData {
    uuid: string;
    uuidGuild: string;
    name: string;
    position: number;
}

interface Course {
    uuidCourse: string;
    name: string;
    isCertified: boolean;
    uuidGuild: string;
    uuidCategory: string;
    uuidRole: string;
    createdAt: string;
    updatedAt: string;
}

interface Role {
    uuidRole: string;
    name: string;
    color: string;
    hoist: boolean;
    position: string;
    memberCount: string;
    uuidGuild: string;
    createdAt: string;
    updatedAt: string;
}

export class CourseService {
    private apiUrl: string;
    private client: Client;
    private readonly SIMPLON_GUILD: GuildData = {
        uuid: "1338499599584722965",
        name: "Simplon",
        memberCount: "0",
        configuration: {}
    };
    private readonly TEMPLATE_CATEGORY: CategoryData = {
        uuid: "1344811915301490748",
        uuidGuild: "1338499599584722965",
        name: "Templates Formations",
        position: 0
    };

    constructor(client: Client) {
        this.apiUrl = process.env.API_URL || 'http://localhost:3000';
        this.client = client;
    }

    private async ensureGuild(): Promise<void> {
            try {
                const headers = await authService.getAuthHeaders();

                const response = await fetch(`${this.apiUrl}/guilds/${this.SIMPLON_GUILD.uuid}`);
                
                if (!response.ok) {
                    const createResponse = await fetch(`${this.apiUrl}/guilds`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(this.SIMPLON_GUILD),
                    });
    
                    if (!createResponse.ok) {
                        throw new Error('Impossible de créer la guild dans l\'API');
                    }
    
                    logger.info('Guild créée dans l\'API avec succès');
                }
            } catch (error) {
                logger.error(error, 'Erreur lors de la vérification/création de la guild dans l\'API');
                throw error;
            }
    }

    private async ensureTemplateCategory(): Promise<void> {
        try {
            const headers = await authService.getAuthHeaders();

            logger.debug({
                categoryData: this.TEMPLATE_CATEGORY,
                endpoint: `${this.apiUrl}/categories/${this.TEMPLATE_CATEGORY.uuid}`
            }, 'Vérification de la catégorie dans l\'API');
    
            const response = await fetch(`${this.apiUrl}/categories/${this.TEMPLATE_CATEGORY.uuid}`);
            const categoryData = await response.json();
            
            if (!response.ok || !categoryData || !categoryData.uuid) {
                const createResponse = await fetch(`${this.apiUrl}/categories`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(this.TEMPLATE_CATEGORY),
                });

                if (!createResponse.ok) {
                    throw new Error('Impossible de créer la catégorie dans l\'API');
                }

                logger.info('Catégorie créée dans l\'API avec succès');
            }
        } catch (error) {
            logger.error(error, 'Erreur lors de la vérification/création de la catégorie dans l\'API');
            throw error;
        }
    }

    async getAllCourses(): Promise<Course[]> {
        try {
            const response = await fetch(`${this.apiUrl}/courses`);
            if (!response.ok) throw new Error('Erreur lors de la récupération des formations');
            
            const courses = await response.json();
            return courses;
        } catch (error) {
            logger.error(error, 'Erreur lors de la récupération des formations');
            throw error;
        }
    }

    async getCourse(id: string): Promise<Course> {        
        try {
            const response = await fetch(`${this.apiUrl}/courses/${id}`);
            if (!response.ok) throw new Error('Formation non trouvée');
            return await response.json();
        } catch (error) {
            logger.error(error, 'Erreur lors de la récupération de la formation');
            throw error;
        }
    }

    async createCourse(name: string, isCertified: boolean): Promise<Course> {
        try {
            await this.ensureGuild();
            await this.ensureTemplateCategory();
            const headers = await authService.getAuthHeaders();

            const guildId = process.env.GUILD_ID;
            if (!guildId) {
                throw new Error('GUILD_ID non défini dans les variables d\'environnement');
            }

            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) {
                throw new Error('Impossible de trouver le serveur Discord');
            }

            const categoryId = "1344811915301490748";

            const forumName = name;
            const existingForum = guild.channels.cache.find(
                channel => channel.name === forumName && channel.type === ChannelType.GuildForum
            );
            
            if (existingForum) {
                throw new Error('Une formation avec ce nom existe déjà');
            }

            const forum = await guild.channels.create({
                name: `${name}`,
                type: ChannelType.GuildForum,
                parent: categoryId,
                reason: `Création du forum pour la formation ${name}`
            });

            let role;
            try {
                logger.debug('Création du rôle Discord...');
                role = await guild.roles.create({
                    name: name,
                    color: '#FF0000',
                    reason: `Création du rôle pour la formation ${name}`
                });
                logger.debug({ roleId: role.id }, 'Rôle Discord créé avec succès');
            } catch (error) {
                logger.error(error, 'Erreur lors de la création du rôle Discord');
                throw new Error('Impossible de créer le rôle Discord pour la formation');
            }

            const roleResponse = await fetch(`${this.apiUrl}/roles`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: role.name,
                    uuidGuild: guildId,
                    uuidRole: role.id,
                    memberCount: "0",
                    rolePosition: "1",
                    hoist: role.hoist,
                    color: role.hexColor
                }),
            });
    
            if (!roleResponse.ok) {
                await role.delete().catch(e => logger.error(e, 'Erreur lors de la suppression du rôle Discord'));
                throw new Error('Erreur lors de la création du rôle dans l\'API');
            }

            const courseData = {
                name,
                isCertified,
                uuidGuild: guildId,
                uuidCategory: categoryId,
                uuidRole: role.id
            };
    
            logger.debug({ 
                courseData,
                endpoint: `${this.apiUrl}/courses`
            }, 'Tentative de création de formation dans l\'API');

            const response = await fetch(`${this.apiUrl}/courses`, {
                method: 'POST',
                headers,
                body: JSON.stringify(courseData),
            });

            if (!response.ok) {
                const errorData = await response.text();
                logger.error({
                    status: response.status,
                    errorData
                }, 'Réponse d\'erreur de l\'API');
                throw new Error('Erreur lors de la création de la formation');
            }
            return await response.json();
        } catch (error) {
            logger.error(error, 'Erreur lors de la création de la formation');
            throw error;
        }
    }

    async deleteCourse(courseId: string): Promise<void> {
        try {
            const discordChannel = await this.client.channels.fetch(courseId);
            if (!discordChannel || !('name' in discordChannel)) {
                throw new Error('Course not found');
            }
    
            if (!(discordChannel instanceof GuildChannel)) {
                throw new Error('Invalid course type');
            }
    
            logger.debug({
                channelId: courseId,
                channelName: discordChannel.name
            }, 'Channel Discord trouvé');
    
            const response = await fetch(`${this.apiUrl}/courses`);
        
            if (!response.ok) {
                const errorData = await response.text();
                logger.error({
                    status: response.status,
                    errorData
                }, 'Réponse d\'erreur de l\'API');
                throw new Error('Erreur lors de la récupération des formations');
            }
    
            const { data: courses } = await response.json();
            
            const course = courses.find((c: Course) => c.name === discordChannel.name);
            
            if (!course) {
                throw new Error(`Formation "${discordChannel.name}" non trouvée`);
            }
    
            logger.debug({
                courseName: course.name,
                courseUuid: course.uuid,
                roles: course.roles
            }, 'Formation trouvée avec ses rôles');
    
            // Stocker l'ID du rôle pour plus tard
            const roleId = course.roles?.[0]?.uuidRole;
    
            // Supprimer d'abord la formation
            logger.debug({
                courseUuid: course.uuid,
                endpoint: `${this.apiUrl}/courses/${course.uuid}`
            }, 'Tentative de suppression de la formation');
    
            const deleteResponse = await fetch(`${this.apiUrl}/courses/${course.uuid}`, {
                method: 'DELETE'
            });
    
            if (!deleteResponse.ok) {
                const errorText = await deleteResponse.text();
                logger.error({
                    status: deleteResponse.status,
                    response: errorText
                }, 'Erreur détaillée de la suppression de la formation');
                throw new Error('Erreur lors de la suppression de la formation');
            }
    
            logger.info({
                courseId: course.uuid,
                courseName: course.name
            }, 'Formation supprimée avec succès');
    
            // Puis supprimer le rôle si on en avait un
            if (roleId) {
                logger.debug({
                    roleId,
                    endpoint: `${this.apiUrl}/roles/${roleId}`
                }, 'Tentative de suppression du rôle');
    
                const deleteRoleResponse = await fetch(`${this.apiUrl}/roles/${roleId}`, {
                    method: 'DELETE'
                });
    
                if (!deleteRoleResponse.ok) {
                    const errorText = await deleteRoleResponse.text();
                    logger.error({
                        status: deleteRoleResponse.status,
                        response: errorText
                    }, 'Erreur lors de la suppression du rôle');
                    throw new Error('Erreur lors de la suppression du rôle');
                }
    
                logger.info({
                    roleId,
                    roleName: course.roles[0].name
                }, 'Rôle supprimé avec succès');
            }
    
        } catch (error) {
            logger.error({
                error,
                courseId,
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            }, 'Erreur lors de la suppression de la formation');
            throw error;
        }
    }
}
