import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandInteraction, Client, TextChannel, Guild } from 'discord.js';
import { execute } from '../commands/create-course.command';

describe('Create Course Command', () => {
    let mockInteraction: CommandInteraction;
    let mockClient: Client;
    let mockGuild: Guild;

    beforeEach(() => {
        mockClient = {
        } as unknown as Client;

        mockGuild = {
        } as unknown as Guild;

        mockInteraction = {
            guild: mockGuild,
            client: mockClient,
            reply: vi.fn(),
            showModal: vi.fn(),
        } as unknown as CommandInteraction;
    });

    it('should show a modal when executed', async () => {
        await execute(mockInteraction);
        expect(mockInteraction.showModal).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
        mockInteraction.showModal = vi.fn().mockRejectedValue(new Error('Test error'));
        await execute(mockInteraction);
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: expect.stringContaining('❌'),
            ephemeral: true
        });
    });
});