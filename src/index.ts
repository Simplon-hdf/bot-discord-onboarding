import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import { InteractionHandler } from './handlers/interaction.handler';
import { authService } from './services/auth.service';

import { initializeEnvironment } from './config/env-validator';

dotenv.config();

logger.info('🚀 Démarrage du bot...');

// Validation sécurisée de l'environnement
const envConfig = initializeEnvironment();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const interactionHandler = new InteractionHandler(client);

client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`✅ Bot connecté en tant que ${readyClient.user.tag}`);
    
    // Initialiser l'authentification avec l'API
    try {
        logger.info('🔐 Initialisation de l\'authentification avec l\'API...');
        await authService.getValidToken();
        logger.info('✅ Authentification API initialisée avec succès');
    } catch (error) {
        logger.error(error, '❌ Erreur lors de l\'initialisation de l\'authentification API');
        logger.warn('⚠️ Le bot fonctionnera mais sans accès à l\'API');
    }
});

// Gestion des interactions
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        await interactionHandler.handleInteraction(interaction);
    } catch (error) {
        logger.error(`❌ Erreur lors de l'exécution d'une interaction :`, error);

        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ Une erreur est survenue.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
});

// Écoute des messages
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;
    
    logger.debug({
        author: message.author.tag,
        content: message.content,
        channel: message.channel.id
    }, 'Message reçu');
    
    if (message.content === '!ping') {
        message.reply('Pong! 🏓');
        logger.info({
            command: 'ping',
            user: message.author.tag
        }, 'Commande exécutée');
    }
});

// Gestion des erreurs globales
client.on(Events.Error, (error) => {
    logger.error(error, 'Une erreur est survenue avec le client Discord');
});

client.login(envConfig.botToken)
    .catch((error) => {
        logger.fatal(error, 'Impossible de connecter le bot');
        process.exit(1);
    });
