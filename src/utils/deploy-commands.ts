import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { logger } from '../config/logger';

import { data as createCampusCommand } from '../campuses/commands/create-campus.command';
import { data as modifyCampusCommand } from '../campuses/commands/modify-campus.command';
import { data as deleteCampusCommand } from '../campuses/commands/delete-campus.command';
import { data as showCampusFormCommand } from '../campuses/commands/show-campus-form.command';
import { data as setupIdentificationCommand } from '../identification_requests/commands/setupIdentificationButton';
import { data as createCourseCommand } from '../courses/commands/create-course.command';
import { data as deleteCourseCommand } from '../courses/commands/delete-course.command';
import { data as showCourseFormCommand } from '../courses/commands/show-course-form.command';
import { data as createPromoCommand } from '../promotions/commands/create-promo.command';
import { data as stockManagementFormCommand } from '../channels/commands/stock-management.command';

dotenv.config();

// Vérification des variables d'environnement requises
const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
    logger.fatal("❌ Variables d'environnement manquantes ! Vérifiez votre fichier .env");
    process.exit(1);
}

const commands = [
    createCampusCommand.toJSON(),
    modifyCampusCommand.toJSON(),
    deleteCampusCommand.toJSON(),
    showCampusFormCommand.toJSON(),
    createPromoCommand.toJSON(),
    setupIdentificationCommand.toJSON(),
    stockManagementFormCommand.toJSON(),
    createCourseCommand.toJSON(),
    deleteCourseCommand.toJSON(),
    showCourseFormCommand.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

async function deployCommands() {
    try {
        logger.info('🚀 Début du déploiement des commandes slash...');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID!),
            { body: commands }
        );

        logger.info('✅ Commandes slash déployées avec succès !');
    } catch (error) {
        logger.error("❌ Erreur lors du déploiement des commandes slash :", error);
    }
}

deployCommands();
