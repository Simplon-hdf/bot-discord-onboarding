import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalSubmitInteraction, Client, Guild, GuildMember, Collection, Role, ChannelType, ForumChannel } from 'discord.js';
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

    beforeEach(() => {
        mockClient = {
        } as unknown as Client;
        handler = new CourseInteractionsHandler(mockClient);
        vi.clearAllMocks();
    });

    describe('Course Creation', () => {
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
});