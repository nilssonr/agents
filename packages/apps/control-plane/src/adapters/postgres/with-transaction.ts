import type { Pool, PoolClient } from 'pg';

/** Common query interface shared by {@link Pool} and {@link PoolClient}. */
export type Queryable = Pool | PoolClient;

/**
 * Runs `callback` inside a database transaction. Acquires a client from the
 * pool, issues BEGIN, invokes the callback, then COMMITs on success or
 * ROLLBACKs on error. The client is always released back to the pool.
 */
export async function withTransaction<T>(
    pool: Pool,
    callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
