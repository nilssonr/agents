import { describe, expect, it, vi } from 'vitest';

import { withTransaction } from './with-transaction.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createFakePool() {
    const queries: string[] = [];
    const client = {
        query: vi.fn((sql: string) => {
            queries.push(sql);
            return Promise.resolve();
        }),
        release: vi.fn(),
    };
    const pool = {
        connect: vi.fn(() => Promise.resolve(client)),
    };
    return { pool, client, queries };
}

describe('withTransaction', () => {
    it('commits on success and releases the client', async () => {
        const { pool, client, queries } = createFakePool();

        const result = await withTransaction(pool as never, () => {
            return Promise.resolve(42);
        });

        expect(result).toBe(42);
        expect(queries).toEqual(['BEGIN', 'COMMIT']);
        expect(client.release).toHaveBeenCalledOnce();
    });

    it('rolls back on error and releases the client', async () => {
        const { pool, client, queries } = createFakePool();

        await expect(
            withTransaction(pool as never, () => {
                return Promise.reject(new Error('boom'));
            }),
        ).rejects.toThrow('boom');

        expect(queries).toEqual(['BEGIN', 'ROLLBACK']);
        expect(client.release).toHaveBeenCalledOnce();
    });

    it('passes the client to the callback', async () => {
        const { pool, client } = createFakePool();

        await withTransaction(pool as never, (c) => {
            expect(c).toBe(client);
            return Promise.resolve();
        });
    });
});
