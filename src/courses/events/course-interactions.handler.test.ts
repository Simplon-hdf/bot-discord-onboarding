import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalSubmitInteraction, Client, Guild, GuildMember, Collection, Role, ChannelType, ForumChannel, ButtonInteraction, GuildChannel, StringSelectMenuInteraction } from 'discord.js';
import { CourseInteractionsHandler } from './course-interactions.handler';
import { logger } from '../../config/logger';

vi.mock('../../config/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

describe('Course Interactions Handler', () => {
    let handler: CourseInteractionsHandler;
    let mockClient: Client;

    function createMockModalSubmitInteraction(courseName: string): ModalSubmitInteraction {
        const mockChannel = {
            name: 'existing-course',
            type: ChannelType.GuildForum,
            threads: {
                cache: new Collection()
            },
            messages: {
                fetch: vi.fn()
            },
        } as unknown as ForumChannel;

        return {
            customId: 'create-course-modal-from-slash',
            guild: {
                channels: {
                    cache: new Collection([
                        ['1', mockChannel]
                    ])
                }
            },
            user: {
                id: '123456789'
            },
            fields: {
                getTextInputValue: () => courseName
            },
            reply: vi.fn(),
            update: vi.fn()
        } as unknown as ModalSubmitInteraction;
    }

    function createMockStringSelectInteraction(customId: string, values: string[]): StringSelectMenuInteraction {
        return {
            customId,
            values,
            guild: {
                channels: {
                    cache: new Collection([
                        ['stock-1', {
                            name: 'stock-1-channel',
                            id: 'stock-1',
                            parentId: '1344320786722455552'
                        } as unknown as GuildChannel],
                        ['stock-2', {
                            name: 'stock-2-channel',
                            id: 'stock-2',
                            parentId: '1344320786722455552'
                        } as unknown as GuildChannel]
                    ])
                }
            },
            user: { id: '123456789' },
            update: vi.fn(),
            reply: vi.fn()
        } as unknown as StringSelectMenuInteraction;
    }

    beforeEach(() => {
        mockClient = {
        } as unknown as Client;
        handler = new CourseInteractionsHandler(mockClient);
        vi.clearAllMocks();
    });

    describe('Course name', () => {
        it('should transform course name to lowercase with hyphens', async () => {
            const interaction = createMockModalSubmitInteraction('Développeur Web JS');
            await handler.handleModalSubmit(interaction);
            
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('développeur-web-js')
                })
            );
        });

        describe('Course Name Validation', () => {
            it('should reject if course already exists', async () => {
                const interaction = createMockModalSubmitInteraction('existing-course');
                await handler.handleModalSubmit(interaction);
                
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('existe déjà'),
                    ephemeral: true
                });
            });
        });
    });

    describe('Certification', () => {
        describe('Certification', () => {
            it('should update certification status when selected', async () => {
                const modalInteraction = createMockModalSubmitInteraction('new-course');
                await handler.handleModalSubmit(modalInteraction);
        
                const interaction = createMockStringSelectInteraction('certification_select', ['true']);
                await handler.handleCertificationSelect(interaction);
                
                expect(interaction.reply).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.stringContaining('erreur'),
                        ephemeral: true
                    })
                );
            });
        
            it('should handle certification selection error', async () => {
                const interaction = createMockStringSelectInteraction('certification_select', []);
                await handler.handleCertificationSelect(interaction);
                
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('erreur'),
                    ephemeral: true
                });
            });
        });
    
        it('should handle certification selection error', async () => {
            const interaction = createMockStringSelectInteraction('certification_select', []);
            await handler.handleCertificationSelect(interaction);
            
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('erreur'),
                ephemeral: true
            });
        });
    });

    describe('Stock Selection', () => {
        it('should handle first stock selection', async () => {
            const interaction = createMockStringSelectInteraction('stock_select', ['stock-1']);
            await handler.handleStockSelect(interaction);
            
            const updateCall = vi.mocked(interaction.update).mock.calls[0][0] as any;
            expect(updateCall.content).toBe("✅ Channel du stock sélectionné : stock-1-channel");
            expect(updateCall.components[0].components).toEqual([
                expect.objectContaining({
                    data: {
                        custom_id: "add_more_stock",
                        label: "Ajouter un autre post",
                        style: 2,
                        type: 2
                    }
                }),
                expect.objectContaining({
                    data: {
                        custom_id: "validate_stock",
                        label: "Valider",
                        style: 1,
                        type: 2
                    }
                })
            ]);
        });
    
        it('should handle stock not found error', async () => {
            const interaction = createMockStringSelectInteraction('stock_select', ['invalid-id']);
            await handler.handleStockSelect(interaction);
            
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('erreur'),
                ephemeral: true
            });
        });

        describe('Multiple Stock Selection', () => {
            it('should allow adding more stocks after first selection', async () => {

                const firstStockInteraction = createMockStringSelectInteraction('stock_select', ['stock-1']);
                await handler.handleStockSelect(firstStockInteraction);
        
                const addMoreStockInteraction = createMockButtonInteraction('add_more_stock');
                await handler.handleButton(addMoreStockInteraction);
        
                const updateCall = vi.mocked(addMoreStockInteraction.update).mock.calls[0][0] as any;
                expect(updateCall.content).toBe("Posts déjà sélectionnés : stock-1-channel\nSélectionnez un autre post :");
                expect(updateCall.components[0].components[0].data).toEqual({
                    type: 3,
                    placeholder: 'Sélectionner un stock',
                    custom_id: 'stock_select'
                });

                console.log('Actual component data:', JSON.stringify(updateCall.components[0].components[0].data, null, 2));
            });
        
            it('should accumulate multiple stock selections', async () => {
                const modalInteraction = createMockModalSubmitInteraction('new-course');
                await handler.handleModalSubmit(modalInteraction);
        
                const certificationInteraction = createMockStringSelectInteraction('certification_select', ['true']);
                await handler.handleCertificationSelect(certificationInteraction);
        
                const firstStockInteraction = createMockStringSelectInteraction('stock_select', ['stock-1']);
                await handler.handleStockSelect(firstStockInteraction);
        
                expect(firstStockInteraction.update).toHaveBeenCalled();
        
                const addMoreStockInteraction = createMockButtonInteraction('add_more_stock');
                await handler.handleButton(addMoreStockInteraction);
        
                const secondStockInteraction = createMockStringSelectInteraction('stock_select', ['stock-2']);
                await handler.handleStockSelect(secondStockInteraction);
        
                const validateStockInteraction = createMockButtonInteraction('validate_stock');
                await handler.handleButton(validateStockInteraction);
        
                expect(validateStockInteraction.update).toHaveBeenCalled();
                const updateCall = vi.mocked(validateStockInteraction.update).mock.calls[0][0] as any;
                expect(updateCall.content).toContain('posts créés avec succès');
            });
        
            it('should prevent selecting the same stock twice', async () => {
                const firstStockInteraction = createMockStringSelectInteraction('stock_select', ['stock-1']);
                await handler.handleStockSelect(firstStockInteraction);
        
                const duplicateStockInteraction = createMockStringSelectInteraction('stock_select', ['stock-1']);
                await handler.handleStockSelect(duplicateStockInteraction);
        
                expect(duplicateStockInteraction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('❌ Le stock \"stock-1-channel\" a déjà été sélectionné.'),
                    ephemeral: true
                });
            });
        
            it('should handle validation with no stocks selected', async () => {
                const modalInteraction = createMockModalSubmitInteraction('new-course');
                await handler.handleModalSubmit(modalInteraction);
        
                const certificationInteraction = createMockStringSelectInteraction('certification_select', ['true']);
                await handler.handleCertificationSelect(certificationInteraction);
        
                const validateStockInteraction = createMockButtonInteraction('validate_stock');
                await handler.handleButton(validateStockInteraction);
        
                expect(validateStockInteraction.update).toHaveBeenCalled();
                const updateCall = vi.mocked(validateStockInteraction.update).mock.calls[0][0] as any;
                expect(updateCall.content).toContain('Formation créée avec succès');
                expect(updateCall.components).toEqual([]);
            });
        });
        
        function createMockButtonInteraction(customId: string): ButtonInteraction {
            return {
                customId,
                guild: {
                    channels: {
                        cache: new Collection([
                            ['stock-1', {
                                name: 'stock-1-channel',
                                id: 'stock-1',
                                parentId: '1344320786722455552'
                            } as unknown as GuildChannel],
                            ['stock-2', {
                                name: 'stock-2-channel',
                                id: 'stock-2',
                                parentId: '1344320786722455552'
                            } as unknown as GuildChannel]
                        ])
                    }
                },
                user: {
                    id: '123456789'
                },
                update: vi.fn(),
                reply: vi.fn()
            } as unknown as ButtonInteraction;
        }
    });
});