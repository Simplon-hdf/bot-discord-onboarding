import { GuildMember } from "discord.js";
import { logger } from "../../config/logger";

export interface PermissionCheckResult {
  hasPermission: boolean;
  userRoles: string[];
  matchingRole?: string; //Pas utilisé pour l'instant
}

export class PermissionService {
  private static readonly CHANNEL_MANAGEMENT_ROLES = ['Administrateur', 'Directeur', 'CDP'];

  /**
   * Vérifie si un membre a les permissions requises selon une liste de rôles autorisés
   */
  static checkDiscordUserPermission(
    member: GuildMember | null, 
    authorizedRoles: string[],
    context?: string
  ): PermissionCheckResult {
    if (!member) {
      logger.error('Membre non trouvé pour la vérification des permissions');
      return {
        hasPermission: false,
        userRoles: []
      };
    }

    const userRoles = member.roles.cache.map(role => role.name);
    
    logger.debug({
      userId: member.id,
      username: member.user.username,
      userRoles: userRoles,
      authorizedRoles: authorizedRoles,
      context: context || 'permission_check'
    }, 'Vérification des permissions utilisateur');

    const matchingRole = userRoles.find(role => authorizedRoles.includes(role));
    const hasPermission = !!matchingRole;

    if (hasPermission) {
      logger.info({
        userId: member.id,
        username: member.user.username,
        matchingRole,
        context: context || 'permission_check'
      }, 'Permissions validées avec succès');
    } else {
      logger.warn({
        userId: member.id,
        userRoles: userRoles,
        action: 'unauthorized_access',
        context: context || 'permission_check'
      }, 'Tentative d\'accès non autorisée');
    }

    return {
      hasPermission,
      userRoles,
      matchingRole
    };
  }

  /**
   * Vérifie si un membre a les permissions pour gérer les channels
   */
  static checkChannelManagementPermissions(member: GuildMember | null): PermissionCheckResult {
    return this.checkDiscordUserPermission(member, this.CHANNEL_MANAGEMENT_ROLES, 'channel_management');
  }

  /**
   * Retourne les rôles autorisés pour la gestion des channels
   */
  static getChannelManagementRoles(): readonly string[] {
    return this.CHANNEL_MANAGEMENT_ROLES;
  }

  /**
   * Retourne les rôles autorisés pour la gestion des channels
   * @deprecated Utilisez getChannelManagementRoles() à la place
   */
  static getAuthorizedRoles(): readonly string[] {
    return this.getChannelManagementRoles();
  }
} 