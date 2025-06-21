import { logger } from './logger';

// ========================================
// TYPES ET INTERFACES
// ========================================

interface EnvConfig {
  botToken: string;
  clientId: string;
  guildId: string;
  apiUrl: string;
  nodeEnv: string;
}

interface ValidationRule {
  required: boolean;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

type EnvValidationRules = {
  [K in keyof EnvConfig]: ValidationRule;
};

// ========================================
// ERREURS PERSONNALISÉES
// ========================================

export class EnvironmentValidationError extends Error {
  constructor(message: string, public missingCount: number) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

// ========================================
// VALIDATEURS
// ========================================

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidDiscordToken = (token: string): boolean => {
  // Format basique d'un token Discord Bot (peut être affiné)
  return /^[A-Za-z0-9._-]{50,}$/.test(token);
};

const isValidSnowflake = (id: string): boolean => {
  // Discord snowflake: nombre de 17-19 chiffres
  return /^\d{17,19}$/.test(id);
};

// ========================================
// RÈGLES DE VALIDATION
// ========================================

const validationRules: EnvValidationRules = {
  botToken: {
    required: true,
    validator: isValidDiscordToken,
    errorMessage: 'BOT_TOKEN must be a valid Discord bot token format'
  },
  clientId: {
    required: true,
    validator: isValidSnowflake,
    errorMessage: 'CLIENT_ID must be a valid Discord snowflake ID'
  },
  guildId: {
    required: true,
    validator: isValidSnowflake,
    errorMessage: 'GUILD_ID must be a valid Discord snowflake ID'
  },
  apiUrl: {
    required: true,
    validator: isValidUrl,
    errorMessage: 'API_URL must be a valid URL'
  },
  nodeEnv: {
    required: false
  }
};

// ========================================
// MAPPING SÉCURISÉ DES VARIABLES
// ========================================

const ENV_MAPPING = {
  botToken: ['DISCORD_BOT_TOKEN', 'BOT_TOKEN'],
  clientId: ['DISCORD_CLIENT_ID', 'CLIENT_ID'],
  guildId: ['DISCORD_GUILD_ID', 'GUILD_ID'],
  apiUrl: ['API_URL'],
  nodeEnv: ['NODE_ENV']
} as const;

// ========================================
// FONCTIONS DE VALIDATION
// ========================================

/**
 * Récupère une variable d'environnement en essayant plusieurs noms possibles
 */
function getEnvValue(possibleNames: readonly string[]): string | undefined {
  for (const name of possibleNames) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Valide et récupère la configuration environnement
 */
export function validateAndGetEnvConfig(): EnvConfig {
  const errors: string[] = [];
  const config: Partial<EnvConfig> = {};

  // Validation de chaque variable
  for (const [configKey, rule] of Object.entries(validationRules)) {
    const possibleNames = ENV_MAPPING[configKey as keyof typeof ENV_MAPPING];
    const value = getEnvValue(possibleNames);

    if (!value) {
      if (rule.required) {
        errors.push(`Missing required environment variable: ${possibleNames.join(' or ')}`);
      }
      continue;
    }

    // Validation du format si un validateur est défini
    if (rule.validator && !rule.validator(value)) {
      errors.push(rule.errorMessage || `Invalid format for ${possibleNames.join(' or ')}`);
      continue;
    }

    config[configKey as keyof EnvConfig] = value;
  }

  // Gestion des erreurs
  if (errors.length > 0) {
    const isProd = process.env.NODE_ENV === 'production';
    
    if (isProd) {
      // En production : log générique sans détails
      logger.fatal('❌ Environment configuration validation failed');
      logger.fatal(`Configuration errors detected: ${errors.length} issue(s)`);
    } else {
      // En développement : log détaillé
      logger.fatal('❌ Environment validation failed:', errors);
    }

    throw new EnvironmentValidationError(
      `Environment validation failed with ${errors.length} error(s)`,
      errors.length
    );
  }

  // Valeurs par défaut pour les variables optionnelles
  return {
    nodeEnv: config.nodeEnv || 'development',
    ...config
  } as EnvConfig;
}

/**
 * Initialise et valide l'environnement au démarrage
 */
export function initializeEnvironment(): EnvConfig {
  try {
    logger.info('🔧 Validating environment configuration...');
    const config = validateAndGetEnvConfig();
    logger.info('✅ Environment configuration validated successfully');
    return config;
  } catch (error) {
    if (error instanceof EnvironmentValidationError) {
      // Exit propre pour les erreurs de configuration
      logger.fatal('🚫 Application cannot start due to configuration errors');
      
      // Graceful shutdown au lieu de process.exit(1)
      setTimeout(() => {
        process.exit(1);
      }, 1000);
      
      throw error;
    }
    
    // Autres erreurs inattendues
    logger.fatal(error, '💥 Unexpected error during environment validation');
    throw error;
  }
}

// ========================================
// UTILITAIRES POUR LES TESTS
// ========================================

/**
 * Vérifie si l'environnement est configuré sans lever d'erreur
 * Utile pour les health checks
 */
export function isEnvironmentValid(): boolean {
  try {
    validateAndGetEnvConfig();
    return true;
  } catch {
    return false;
  }
} 