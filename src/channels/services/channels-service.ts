import { Client, Guild, ChannelType } from "discord.js";
import { logger } from "../../config/logger";
import { authService } from "../../services/auth.service";

interface CreateChannelDto {
  uuid: string;
  name: string;
  type: string;
  channelPosition: number;
  uuidGuild: string;
  uuidCategory: string;
}

export class ChannelService {
  private apiUrl: string;
  private isCreating: boolean = false;

  constructor(private client: Client, private guild: Guild) {
    this.apiUrl = process.env.API_URL || "http://localhost:3000";
  }

  async getStockChannels() {
    logger.info(`🔍 Début de getStockChannels()`);

    const guild = await this.client.guilds.fetch(process.env.GUILD_ID!);

    try {
      const guildChannels = await guild.channels.fetch();
      logger.info(
        `🔍 Nombre total de channels récupérés : ${guildChannels?.size}`
      );

      if (!guildChannels) {
        throw new Error("❌ Impossible de récupérer les channels du serveur.");
      }

      logger.info(`🔍 STOCK_ID défini ? ${process.env.STOCK_ID}`);

      if (!process.env.STOCK_ID) {
        throw new Error("❌ STOCK_ID est undefined !");
      }

      const channels = guildChannels.filter(
        (channel) =>
          channel?.parentId === process.env.STOCK_ID &&
          (channel!.type === ChannelType.GuildText ||
            channel!.type === ChannelType.GuildVoice)
      );

      logger.info(
        `✅ Channels filtrés (${channels.size} trouvés) : ${JSON.stringify(
          channels.map((c) => c!.name)
        )}`
      );

      return channels;
    } catch (error) {
      logger.error("❌ Erreur dans getStockChannels() :", error);
      return [];
    }
  }

  async createDiscordChannel(name: string, type: string, position: number, discordUserId?: string) {
    logger.info(`🔍 DEBUG: Début de createDiscordChannel`);
    logger.info(
      `🔍 Paramètres reçus → Name: ${name}, Type: ${type}, Position: ${position}, User: ${discordUserId || 'Non spécifié'}`
    );
    logger.info(`🔍 Guild ID: ${this.guild?.id}`);
    logger.info(`🔍 STOCK_ID: ${process.env.GUILD_ID!}`);

    if (this.isCreating) {
      throw new Error("Un channel est déjà en cours de création.");
    }
    this.isCreating = true;

    try {
      // 1️⃣ Récupérer la guild
      const guild = await this.client.guilds.fetch(process.env.GUILD_ID!);

      // 2️⃣ Vérifier que la catégorie existe
      const category = await guild.channels.fetch(process.env.STOCK_ID!);
      logger.info(
        `🔍 Catégorie récupérée : ${category ? category.name : "Aucune"} (ID: ${
          process.env.STOCK_ID
        })`
      );
      if (!category) {
        throw new Error(
          `❌ La catégorie stock avec ID ${process.env.STOCK_ID} n'existe pas.`
        );
      }
      if (category.type !== ChannelType.GuildCategory) {
        throw new Error(
          `❌ L'ID fourni pour STOCK_ID (${process.env.STOCK_ID}) n'est pas une catégorie valide.`
        );
      }
      logger.info(
        `✅ Catégorie stock trouvée : ${category.name} (${category.id})`
      );

      // 3️⃣ Créer le channel côté Discord
      const newChannel = await guild.channels.create({
        name: name,
        type: type === "text" ? ChannelType.GuildText : ChannelType.GuildVoice,
        parent: category.id,
        position: position,
      });

      logger.info(
        `🔍 Réponse Discord après création du channel : ${JSON.stringify(
          newChannel
        )}`
      );

      if (!newChannel) {
        throw new Error("❌ Échec de la création du channel Discord.");
      }

      logger.info(
        `✅ Channel créé sur Discord : ${newChannel.name} (${newChannel.id})`
      );

      // 4️⃣ Construire l'objet CreateChannelDto
      const createChannelDto: CreateChannelDto = {
        uuid: newChannel.id, // ID Discord du channel
        name: newChannel.name, // Nom actuel du channel
        type: type, // "text" ou "voice" (ou "announcement" si tu l'ajoutes)
        channelPosition: position, // Ou newChannel.position
        uuidGuild: guild.id, // ID Discord de la guilde
        uuidCategory: category.id, // ID Discord de la catégorie
      };

      // 5️⃣ Envoyer une requête POST vers l'API Nest.js AVEC AUTHENTIFICATION
      logger.info("🔐 Récupération du token d'authentification...");
      const headers = await authService.getAuthHeaders(discordUserId);
      
      const response = await fetch(`${this.apiUrl}/channels`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(createChannelDto),
      });

      if (!response.ok) {
        // Si erreur 401, tenter de renouveler le token
        if (response.status === 401) {
          logger.warn("🔄 Token expiré, renouvellement...");
          await authService.forceReauthenticate();
          const newHeaders = await authService.getAuthHeaders(discordUserId);
          
          const retryResponse = await fetch(`${this.apiUrl}/channels`, {
            method: "POST",
            headers: newHeaders,
            body: JSON.stringify(createChannelDto),
          });
          
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(
              `Erreur API Channels après retry: ${retryResponse.status} - ${errorText}`
            );
          }
          
          const retryData = await retryResponse.json();
          logger.info(`✅ Channel enregistré en base (après retry) : ${JSON.stringify(retryData)}`);
          return newChannel;
        }
        
        // Gérer le cas d'erreur HTTP
        const errorText = await response.text();
        throw new Error(
          `Erreur API Channels: ${response.status} - ${errorText}`
        );
      }

      // 6️⃣ Récupérer la réponse de l'API
      const data = await response.json();
      logger.info(`✅ Channel enregistré en base : ${JSON.stringify(data)}`);

      return newChannel; // ou return data si tu veux renvoyer l'objet de l'API
    } catch (error) {
      logger.error(error, "Erreur lors de la création du channel Discord");
      throw error;
    } finally {
      this.isCreating = false;
    }
  }

  async updateDiscordChannel(
    uuid: string,
    updates: { name?: string; channelPosition?: number },
    discordUserId?: string
  ) {
    logger.info(`🔍 DEBUG: Début de updateDiscordChannel`);
    logger.info(`🔍 Channel UUID: ${uuid}`);
    logger.info(`🔍 Paramètres reçus → ${JSON.stringify(updates)}`);
    logger.info(`🔍 User ID: ${discordUserId || 'Non spécifié'}`);

    try {
      // 1️⃣ Récupérer la guilde
      const guild = await this.client.guilds.fetch(process.env.GUILD_ID!);
      logger.info(`✅ Guild trouvée: ${guild.name} (${guild.id})`);

      // 2️⃣ Vérifier que le channel existe sur Discord
      const discordChannel = await guild.channels.fetch(uuid);
      if (!discordChannel) {
        throw new Error(`❌ Channel ${uuid} non trouvé sur Discord.`);
      }
      logger.info(
        `✅ Channel trouvé sur Discord: ${discordChannel.name} (${discordChannel.id})`
      );

      // 3️⃣ Construire les mises à jour
      const discordUpdates: any = {};
      if (updates.name) discordUpdates.name = updates.name;
      if (updates.channelPosition !== undefined)
        discordUpdates.position = updates.channelPosition;

      // 4️⃣ Mettre à jour le channel sur Discord
      await discordChannel.edit(discordUpdates);
      logger.info(`✅ Channel ${uuid} mis à jour sur Discord.`);

      // 5️⃣ Construire l'objet de mise à jour pour l'API
      const updateChannelDto = {
        name: updates.name,
        channelPosition: updates.channelPosition,
      };

      logger.info(
        `📡 Données envoyées à l'API: ${JSON.stringify(updateChannelDto)}`
      );

      // 6️⃣ Envoyer la mise à jour vers l'API AVEC AUTHENTIFICATION
      logger.info("🔐 Récupération du token d'authentification...");
      const headers = await authService.getAuthHeaders(discordUserId);
      
      const response = await fetch(`${this.apiUrl}/channels/${uuid}`, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(updateChannelDto),
      });

      // 7️⃣ Vérifier la réponse de l'API
      const responseText = await response.text();
      logger.info(`📡 Réponse API: ${response.status} - ${responseText}`);

      if (!response.ok) {
        throw new Error(
          `❌ Erreur API lors de l'update: ${response.status} - ${responseText}`
        );
      }

      // 8️⃣ Retourner la réponse mise à jour
      const updatedChannelFromApi = JSON.parse(responseText);
      logger.info(
        `✅ Channel mis à jour en base: ${JSON.stringify(
          updatedChannelFromApi
        )}`
      );

      return updatedChannelFromApi;
    } catch (error) {
      logger.error(
        `❌ Erreur lors de la mise à jour du channel ${uuid}:`,
        error
      );
      throw error;
    }
  }

  async deleteDiscordChannel(uuid: string, discordUserId?: string) {
    logger.info(`🔍 DEBUG: Début de deleteChannelFromAPI`);
    logger.info(`🔍 Channel UUID: ${uuid}`);
    logger.info(`🔍 User ID: ${discordUserId || 'Non spécifié'}`);

    try {
      // 1️⃣ Appeler l'API pour supprimer le channel en base AVEC AUTHENTIFICATION
      logger.info(`📡 Requête de suppression à l'API pour le channel: ${uuid}`);
      logger.info("🔐 Récupération du token d'authentification...");
      const headers = await authService.getAuthHeaders(discordUserId);
      
      const response = await fetch(`${this.apiUrl}/channels/${uuid}`, {
        method: "DELETE",
        headers: headers,
        body: JSON.stringify({ uuid }), // Ajout d'un body vide ou minimal
      });

      // 2️⃣ Vérifier la réponse de l'API
      const responseText = await response.text();
      logger.info(`📡 Réponse API: ${response.status} - ${responseText}`);

      if (!response.ok) {
        // Si erreur 401, tenter de renouveler le token
        if (response.status === 401) {
          logger.warn("🔄 Token expiré, renouvellement...");
          await authService.forceReauthenticate();
          const newHeaders = await authService.getAuthHeaders(discordUserId);
          
          const retryResponse = await fetch(`${this.apiUrl}/channels/${uuid}`, {
            method: "DELETE",
            headers: newHeaders,
            body: JSON.stringify({ uuid }),
          });
          
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            throw new Error(
              `Erreur API Channels DELETE après retry: ${retryResponse.status} - ${errorText}`
            );
          }
          
          const retryData = await retryResponse.text();
          logger.info(`✅ Channel supprimé en base (après retry)`);
          return JSON.parse(retryData);
        }
        
        throw new Error(
          `❌ Erreur API lors de la suppression du channel: ${response.status} - ${responseText}`
        );
      }

      // 3️⃣ Retourner la confirmation de suppression
      const deleteConfirmation = JSON.parse(responseText);
      logger.info(
        `✅ Channel supprimé en base: ${JSON.stringify(deleteConfirmation)}`
      );

      return deleteConfirmation;
    } catch (error) {
      logger.error(
        `❌ Erreur lors de la suppression du channel ${uuid}:`,
        error
      );
      if (error instanceof Error) {
        logger.error(error.stack ?? "No stack trace available");
      }
      throw error;
    }
  }

  async validateStockCategory() {
    try {
      const guild = await this.client.guilds.fetch(this.guild.id);
      const category = await guild.channels.fetch(process.env.STOCK_ID!);

      if (!category || category.type !== ChannelType.GuildCategory) {
        logger.error(
          `La catégorie stock (ID: ${process.env.STOCK_ID}) n'existe pas ou n'est pas une catégorie valide.`
        );
        return false;
      }
      return true;
    } catch (error) {
      logger.error(
        error,
        "Erreur lors de la vérification de la catégorie stock"
      );
      return false;
    }
  }
}
