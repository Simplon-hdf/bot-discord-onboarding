import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandInteraction, Client, Guild, GuildMember, Collection, Role, TextInputStyle, TextInputBuilder, ActionRowBuilder, ModalBuilder, ComponentType } from 'discord.js';
import { execute } from '../commands/create-course.command';
import { logger } from '../../config/logger';

vi.mock('../../config/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

describe('Create Course Command', () => {
    let mockInteraction: CommandInteraction;
    let mockClient: Client;
    let mockGuild: Guild;
    let mockMember: GuildMember;

    beforeEach(() => {
        vi.clearAllMocks();

        mockClient = {
        } as unknown as Client;

        mockGuild = {
        } as unknown as Guild;

        mockMember = {
            roles: {
                cache: new Collection<string, Role>()
            },
            id: '123456789'
        } as unknown as GuildMember;

        mockInteraction = {
            guild: mockGuild,
            client: mockClient,
            reply: vi.fn(),
            showModal: vi.fn(),
        } as unknown as CommandInteraction;
    });

    describe('Permissions', () => {
        it('should fail if member is null', async () => {
            mockInteraction.member = null;
    
            await execute(mockInteraction);
    
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '❌ Membre non trouvé',
                ephemeral: true
            });
            expect(logger.error).toHaveBeenCalled();
        });

        it('should allow user with multiple roles including one authorized', async () => {
            mockInteraction.member = {
                roles: {
                    cache: new Collection<string, Role>([
                        ['1', { name: 'User' } as Role],
                        ['2', { name: 'CDP' } as Role],
                        ['3', { name: 'Member' } as Role]
                    ])
                },
                id: '123456789'
            } as unknown as GuildMember;

            await execute(mockInteraction);

            expect(mockInteraction.showModal).toHaveBeenCalled();
        });

        it('should allow user with multiple authorized roles', async () => {
            mockInteraction.member = {
                roles: {
                    cache: new Collection<string, Role>([
                        ['1', { name: 'Administrateur' } as Role],
                        ['2', { name: 'CDP' } as Role]
                    ])
                },
                id: '123456789'
            } as unknown as GuildMember;

            await execute(mockInteraction);

            expect(mockInteraction.showModal).toHaveBeenCalled();
        });

        it('should block users without required roles', async () => {
            const unauthorizedRoles = new Collection<string, Role>([
                ['1', { name: 'User' } as Role],
                ['2', { name: 'Member' } as Role]
            ]);

            mockInteraction.member = {
                roles: {
                    cache: unauthorizedRoles
                },
                id: '123456789'
            } as unknown as GuildMember;

            await execute(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('❌ Vous n\'avez pas les permissions nécessaires pour créer une formation.'),
                ephemeral: true
            });
            expect(mockInteraction.showModal).not.toHaveBeenCalled();
        });

        it('should allow users with CDP role', async () => {
            mockInteraction.member = {
                roles: {
                    cache: new Collection<string, Role>([
                        ['1', { name: 'CDP' } as Role]
                    ])
                },
                id: '123456789'
            } as unknown as GuildMember;

            await execute(mockInteraction);

            expect(mockInteraction.showModal).toHaveBeenCalled();
            expect(mockInteraction.reply).not.toHaveBeenCalled();
        });

        it('should allow users with Administrateur role', async () => {
            mockInteraction.member = {
                roles: {
                    cache: new Collection<string, Role>([
                        ['1', { name: 'Administrateur' } as Role]
                    ])
                },
                id: '123456789'
            } as unknown as GuildMember;

            await execute(mockInteraction);

            expect(mockInteraction.showModal).toHaveBeenCalled();
            expect(mockInteraction.reply).not.toHaveBeenCalled();
        });

        it('should allow users with Directeur role', async () => {
            mockInteraction.member = {
                roles: {
                    cache: new Collection<string, Role>([
                        ['1', { name: 'Directeur' } as Role]
                    ])
                },
                id: '123456789'
            } as unknown as GuildMember;

            await execute(mockInteraction);

            expect(mockInteraction.showModal).toHaveBeenCalled();
            expect(mockInteraction.reply).not.toHaveBeenCalled();
        });
    });

    describe('Guild validation', () => {
        it('should handle guild not found error', async () => {
            mockInteraction = {
                member: {
                    roles: {
                        cache: new Collection<string, Role>([
                            ['1', { name: 'CDP' } as Role]
                        ])
                    },
                    id: '123456789'
                } as unknown as GuildMember,
                guild: null,
                client: mockClient,
                reply: vi.fn(),
                showModal: vi.fn(),
            } as unknown as CommandInteraction;

            await execute(mockInteraction);

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                '❌ Erreur lors de la création de la modale de formation'
            );
        });
    });

    describe('Modal creation', () => {
        beforeEach(() => {
            mockInteraction = {
                guild: mockGuild,
                client: mockClient,
                member: {
                    roles: {
                        cache: new Collection<string, Role>([
                            ['1', { name: 'CDP' } as Role]
                        ])
                    },
                    id: '123456789'
                } as unknown as GuildMember,
                reply: vi.fn(),
                showModal: vi.fn(),
            } as unknown as CommandInteraction;
        });

        it('should show a modal when executed', async () => {
            mockInteraction.member = {
                roles: {
                cache: new Collection<string, Role>([
                    ['1', { name: 'CDP' } as Role]
                ])
            },
            id: '123456789'
        } as unknown as GuildMember;

            await execute(mockInteraction);
            expect(mockInteraction.showModal).toHaveBeenCalled();
        });

        it('should handle modal creation error', async () => {
            mockInteraction.member = {
                roles: {
                    cache: new Collection<string, Role>([
                        ['1', { name: 'CDP' } as Role]
                    ])
                },
                id: '123456789'
            } as unknown as GuildMember;
            mockInteraction.showModal = vi.fn().mockRejectedValue(new Error('Modal error'));

            await execute(mockInteraction);

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                '❌ Erreur lors de la création de la modale de formation'
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '❌ Une erreur est survenue lors de la création du formulaire.',
                ephemeral: true
            });
        });
    });

    describe('Modal properties', () => {
        beforeEach(() => {
            mockInteraction = {
                guild: mockGuild,
                client: mockClient,
                member: {
                    roles: {
                        cache: new Collection<string, Role>([
                            ['1', { name: 'CDP' } as Role]
                        ])
                    },
                    id: '123456789'
                } as unknown as GuildMember,
                reply: vi.fn(),
                showModal: vi.fn(),
            } as unknown as CommandInteraction;
        });

        it('should create a valid ModalBuilder instance', async () => {
            await execute(mockInteraction);
    
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            
            expect(modalBuilder).toBeInstanceOf(ModalBuilder);
        });
    
        it('should set correct modal basic properties', async () => {
            await execute(mockInteraction);
    
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            
            expect(modalBuilder.data).toEqual(
                expect.objectContaining({
                    custom_id: 'create-course-modal-from-slash',
                    title: 'Créer une nouvelle formation'
                })
            );
        });
    
        it('should contain one action row with one text input', async () => {
            await execute(mockInteraction);
    
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            
            expect(modalBuilder.components).toBeDefined();
            expect(modalBuilder.components.length).toBe(1);
            expect(modalBuilder.components[0].components.length).toBe(1);
        });

        it('should create text input with correct validation rules', async () => {
            await execute(mockInteraction);
    
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            const textInput = modalBuilder.components[0].components[0];
    
            expect(textInput.data).toEqual(
                expect.objectContaining({
                    min_length: 3,
                    max_length: 50,
                    required: true,
                    placeholder: 'Ex: Développeur web'
                })
            );
        });
    
        it('should show modal to user when executed', async () => {
            await execute(mockInteraction);
    
            expect(mockInteraction.showModal).toHaveBeenCalled();
            expect(mockInteraction.reply).not.toHaveBeenCalled();
        });
    
        it('should create text input with correct label and style', async () => {
            await execute(mockInteraction);
    
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            const textInput = modalBuilder.components[0].components[0];
    
            expect(textInput.data).toEqual(
                expect.objectContaining({
                    label: 'Nom de la formation',
                    style: TextInputStyle.Short
                })
            );
        });
    });

    describe('Input Validation', () => {
        beforeEach(() => {
            mockInteraction = {
                guild: mockGuild,
                client: mockClient,
                member: {
                    roles: {
                        cache: new Collection<string, Role>([
                            ['1', { name: 'CDP' } as Role]
                        ])
                    },
                    id: '123456789'
                } as unknown as GuildMember,
                reply: vi.fn(),
                showModal: vi.fn(),
            } as unknown as CommandInteraction;
        });
    
        it('should accept minimum length input (3 characters)', async () => {
            await execute(mockInteraction);
    
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            const textInput = modalBuilder.components[0].components[0];
    
            const minLength = textInput.data.min_length;
            expect(minLength).toBe(3);
    
            expect('Dev'.length >= (minLength ?? 0)).toBe(true);
        });
    
        it('should accept maximum length input (50 characters)', async () => {
            await execute(mockInteraction);
    
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            const textInput = modalBuilder.components[0].components[0];
    
            const maxLength = textInput.data.max_length;
            expect(maxLength).toBe(50);
    
            const maxLengthInput = 'Développeur fullstack JavaScript et React avancé';
            expect(maxLengthInput.length <= (maxLength ?? Infinity)).toBe(true);
        });

        it('should reject input shorter than minimum length (3 characters)', async () => {
            await execute(mockInteraction);
        
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            const textInput = modalBuilder.components[0].components[0];
        
            const minLength = textInput.data.min_length;
            expect(minLength).toBe(3);
        
            const shortInput = 'JS';
            expect(shortInput.length >= (minLength ?? 0)).toBe(false);
        });
        
        it('should reject input longer than maximum length (50 characters)', async () => {
            await execute(mockInteraction);
        
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            const textInput = modalBuilder.components[0].components[0];
        
            const maxLength = textInput.data.max_length;
            expect(maxLength).toBe(50);
        
            const longInput = 'Développeur fullstack JavaScript avec spécialisation React et Node.js';  // 71 caractères
            expect(longInput.length <= (maxLength ?? Infinity)).toBe(false);
        });
    
        it('should accept special characters in course name', async () => {
            await execute(mockInteraction);
    
            const modalCall = vi.mocked(mockInteraction.showModal).mock.calls[0][0];
            const modalBuilder = modalCall as ModalBuilder;
            const textInput = modalBuilder.components[0].components[0];
    
            const minLength = textInput.data.min_length ?? 0;
            const maxLength = textInput.data.max_length ?? Infinity;
    
            const specialChars = [
                'Développeur C#',
                'Formation PHP/MySQL',
                'React & Node.js',
                'UX/UI Design',
                'DevOps & CI/CD'
            ];
    
            specialChars.forEach(input => {
                expect(input.length >= minLength).toBe(true);
                expect(input.length <= maxLength).toBe(true);
            });
        });
    });

    describe('Logging Details', () => {
        it('should log unauthorized access with user details', async () => {
            const mockRoles = new Collection<string, Role>([
                ['1', { name: 'User' } as Role],
                ['2', { name: 'Member' } as Role]
            ]);
    
            mockInteraction.member = {
                roles: {
                    cache: mockRoles
                },
                id: '123456789'
            } as unknown as GuildMember;
    
            await execute(mockInteraction);
    
            expect(logger.warn).toHaveBeenCalledWith(
                {
                    userId: '123456789',
                    userRoles: ['User', 'Member'],
                    action: 'create_course_unauthorized'
                },
                'Tentative de création de formation non autorisée'
            );
        });
    });
});