import { logger } from '../config/logger';

// ========================================
// INTERFACES ET TYPES
// ========================================

interface AuthConfig {
  apiUrl: string;
  botToken: string;
  tokenExpirationMargin: number; // en heures
}

interface AuthApiResponse {
  data: {
    data: {
      token: string;
      expiresIn?: number;
    };
  };
}

interface AuthHeaders extends Record<string, string> {
  'Content-Type': string;
  'Authorization': string;
}

// ========================================
// ERREURS PERSONNALISÉES
// ========================================

class AuthenticationError extends Error {
  constructor(
    message: string, 
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// ========================================
// CONSTANTES
// ========================================

const DEFAULT_CONFIG = {
  API_URL: 'http://localhost:3000',
  TOKEN_EXPIRATION_MARGIN_HOURS: 23, // 23h sur 24h pour la marge de sécurité
  AUTH_ENDPOINT: '/auth/bot-login'
} as const;

// ========================================
// SERVICE D'AUTHENTIFICATION
// ========================================

export class AuthService {
  private config: AuthConfig;
  private jwtToken: string | null = null;
  private tokenExpiration: number | null = null;

  constructor(customConfig?: Partial<AuthConfig>) {
    try {
      this.config = this.buildConfig(customConfig);
      this.validateConfig();
    } catch (error) {
      logger.error(error, '❌ Erreur lors de l\'initialisation du service d\'authentification');
      throw error;
    }
  }

  /**
   * Construit la configuration du service
   */
  private buildConfig(customConfig?: Partial<AuthConfig>): AuthConfig {
    const botToken = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN || '';
    const apiUrl = process.env.API_URL || DEFAULT_CONFIG.API_URL;
    const tokenExpirationMargin = customConfig?.tokenExpirationMargin || DEFAULT_CONFIG.TOKEN_EXPIRATION_MARGIN_HOURS;

    return {
      apiUrl,
      botToken,
      tokenExpirationMargin,
      ...customConfig
    };
  }

  /**
   * Valide la configuration du service
   */
  private validateConfig(): void {
    if (!this.config.botToken.trim()) {
      throw new ConfigurationError(
        'DISCORD_BOT_TOKEN ou BOT_TOKEN est requis dans les variables d\'environnement'
      );
    }

    if (!this.config.apiUrl.trim()) {
      throw new ConfigurationError('API_URL est requise');
    }

    if (this.config.tokenExpirationMargin <= 0 || this.config.tokenExpirationMargin >= 24) {
      throw new ConfigurationError(
        'La marge d\'expiration du token doit être entre 1 et 23 heures'
      );
    }
  }

  /**
   * Valide la réponse de l'API d'authentification
   */
  private validateAuthResponse(data: unknown): AuthApiResponse {
    if (!data || typeof data !== 'object') {
      throw new AuthenticationError('Réponse API invalide: format incorrect');
    }

    const response = data as any;
    
    if (!response.data?.data?.token) {
      throw new AuthenticationError(
        'Réponse API invalide: token manquant dans la structure data.data.token'
      );
    }

    if (typeof response.data.data.token !== 'string') {
      throw new AuthenticationError('Réponse API invalide: le token doit être une chaîne de caractères');
    }

    return response as AuthApiResponse;
  }

  /**
   * Authentifie le bot auprès de l'API et récupère un JWT
   */
  async authenticate(): Promise<string> {
    try {
      logger.info('🔐 Authentification du bot auprès de l\'API...');
      
      const url = `${this.config.apiUrl}${DEFAULT_CONFIG.AUTH_ENDPOINT}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botToken: this.config.botToken
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AuthenticationError(
          `Authentification échouée: ${response.status} - ${errorText}`,
          response.status
        );
      }

      const rawData = await response.json();
      const validatedData = this.validateAuthResponse(rawData);
      
      const token = validatedData.data.data.token;
      this.jwtToken = token;
      
      // Calcul de l'expiration avec la marge configurée
      const expirationMs = this.config.tokenExpirationMargin * 60 * 60 * 1000;
      this.tokenExpiration = Date.now() + expirationMs;
      
      logger.info(`✅ Bot authentifié avec succès, JWT reçu (expire dans ${this.config.tokenExpirationMargin}h)`);
      return token;
      
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.error(error, '❌ Erreur lors de l\'authentification du bot');
        throw error;
      }
      
      const authError = new AuthenticationError(
        `Erreur inattendue lors de l\'authentification: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        undefined,
        error
      );
      
      logger.error(authError, '❌ Erreur inattendue lors de l\'authentification du bot');
      throw authError;
    }
  }

  /**
   * Vérifie si le token JWT est encore valide
   */
  private isTokenValid(): boolean {
    const hasToken = this.jwtToken !== null && this.jwtToken.trim() !== '';
    const hasValidExpiration = this.tokenExpiration !== null && Date.now() < this.tokenExpiration;
    
    return hasToken && hasValidExpiration;
  }

  /**
   * Obtient un token JWT valide (réutilise ou authentifie si nécessaire)
   */
  async getValidToken(): Promise<string> {
    if (this.isTokenValid()) {
      logger.debug('🔄 Réutilisation du token JWT existant');
      return this.jwtToken!;
    }

    logger.info('🔄 Token JWT expiré ou manquant, nouvelle authentification...');
    return await this.authenticate();
  }

  /**
   * Obtient les headers d'authentification pour les requêtes API
   * @param discordUserId - ID de l'utilisateur Discord qui utilise le bot (pour le rate limiting)
   */
  async getAuthHeaders(discordUserId?: string): Promise<AuthHeaders> {
    const token = await this.getValidToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Ajouter l'ID Discord de l'utilisateur pour le rate limiting
    if (discordUserId) {
      headers['X-Discord-User-ID'] = discordUserId;
      logger.debug(`🔍 Header X-Discord-User-ID ajouté: ${discordUserId}`);
    }

    return headers as AuthHeaders;
  }

  /**
   * Force une nouvelle authentification (utile en cas d'erreur 401)
   */
  async forceReauthenticate(): Promise<string> {
    logger.info('🔄 Force la ré-authentification...');
    this.clearToken();
    return await this.authenticate();
  }

  /**
   * Efface le token en mémoire
   */
  private clearToken(): void {
    this.jwtToken = null;
    this.tokenExpiration = null;
  }

  /**
   * Obtient des informations sur l'état du token
   */
  getTokenInfo(): { isValid: boolean; expiresAt: Date | null; timeUntilExpiration: number | null } {
    const isValid = this.isTokenValid();
    const expiresAt = this.tokenExpiration ? new Date(this.tokenExpiration) : null;
    const timeUntilExpiration = this.tokenExpiration ? this.tokenExpiration - Date.now() : null;

    return {
      isValid,
      expiresAt,
      timeUntilExpiration
    };
  }
}

// ========================================
// SINGLETON PATTERN AMÉLIORÉ
// ========================================

class AuthServiceSingleton {
  private static instance: AuthService | null = null;
  private static customConfig: Partial<AuthConfig> | undefined;

  static configure(config: Partial<AuthConfig>): void {
    if (this.instance) {
      logger.warn('⚠️ AuthService déjà initialisé, la nouvelle configuration sera ignorée');
      return;
    }
    this.customConfig = config;
  }

  static getInstance(): AuthService {
    if (!this.instance) {
      this.instance = new AuthService(this.customConfig);
    }
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
    this.customConfig = undefined;
  }
}

// ========================================
// EXPORTS
// ========================================

/**
 * Obtient l'instance singleton du service d'authentification
 */
export function getAuthService(): AuthService {
  return AuthServiceSingleton.getInstance();
}

/**
 * Configure le service d'authentification (doit être appelé avant la première utilisation)
 */
export function configureAuthService(config: Partial<AuthConfig>): void {
  AuthServiceSingleton.configure(config);
}

/**
 * Remet à zéro l'instance singleton (utile pour les tests)
 */
export function resetAuthService(): void {
  AuthServiceSingleton.reset();
}

/**
 * Interface simplifiée pour compatibilité avec l'ancien code
 */
export const authService = {
  getValidToken: () => getAuthService().getValidToken(),
  getAuthHeaders: (discordUserId?: string) => getAuthService().getAuthHeaders(discordUserId),
  forceReauthenticate: () => getAuthService().forceReauthenticate(),
  getTokenInfo: () => getAuthService().getTokenInfo()
};

// Export des types et erreurs pour réutilisation
export type { AuthConfig, AuthHeaders };
export { AuthenticationError, ConfigurationError }; 