import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import { createLogger } from '@agents/logger';
import { parseMigrationFile } from './migration-parser.js';

const log = createLogger('migrations');

/** A migration that has been applied to the database. */
export interface AppliedMigration {
    id: number;
    name: string;
    appliedAt: Date;
}

/** Options for creating a migration runner. */
export interface MigrationRunnerOptions {
    migrationsPath: string;
}

/** Programmatic migration runner for PostgreSQL. */
export interface MigrationRunner {
    /** Lists all applied migrations ordered by id. */
    list(): Promise<AppliedMigration[]>;
    /** Applies all pending migrations and returns the newly applied ones. */
    up(): Promise<AppliedMigration[]>;
    /** Rolls back the last applied migration, or returns undefined if none. */
    down(): Promise<AppliedMigration | undefined>;
}

interface LoadedMigration {
    name: string;
    up: string;
    down: string;
}

/** Ensures the `schema_migrations` tracking table exists. */
async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
}

/** Loads and parses all `*.sql` migration files from a directory, sorted by filename. */
async function loadMigrationFiles(dir: string): Promise<LoadedMigration[]> {
    const entries = await readdir(dir);
    const sqlFiles = entries.filter((f) => f.endsWith('.sql')).sort();

    const migrations: LoadedMigration[] = [];
    for (const file of sqlFiles) {
        const content = await readFile(join(dir, file), 'utf-8');
        const parsed = parseMigrationFile(content);
        migrations.push({ name: file, ...parsed });
    }

    return migrations;
}

/**
 * Creates a programmatic migration runner for PostgreSQL.
 * Reads `*.sql` files from the given directory and tracks applied
 * migrations in a `schema_migrations` table.
 */
export function createMigrationRunner(pool: pg.Pool, opts: MigrationRunnerOptions): MigrationRunner {
    return {
        async list(): Promise<AppliedMigration[]> {
            await ensureMigrationsTable(pool);
            const result = await pool.query<{ id: number; name: string; applied_at: Date }>(
                'SELECT id, name, applied_at FROM schema_migrations ORDER BY id',
            );
            return result.rows.map((r) => ({ id: r.id, name: r.name, appliedAt: r.applied_at }));
        },

        async up(): Promise<AppliedMigration[]> {
            await ensureMigrationsTable(pool);
            const allFiles = await loadMigrationFiles(opts.migrationsPath);
            const applied = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
            const appliedNames = new Set(applied.rows.map((r) => r.name));
            const pending = allFiles.filter((m) => !appliedNames.has(m.name));

            if (pending.length === 0) {
                log.info('no pending migrations');
                return [];
            }

            log.info({ count: pending.length }, 'applying pending migrations');
            const client = await pool.connect();
            const results: AppliedMigration[] = [];
            try {
                await client.query('BEGIN');
                for (const migration of pending) {
                    log.info({ migration: migration.name }, 'applying migration');
                    await client.query(migration.up);
                    const row = await client.query<{ id: number; name: string; applied_at: Date }>(
                        'INSERT INTO schema_migrations (name) VALUES ($1) RETURNING id, name, applied_at',
                        [migration.name],
                    );
                    const r = row.rows[0]!;
                    results.push({ id: r.id, name: r.name, appliedAt: r.applied_at });
                }
                await client.query('COMMIT');
                log.info({ count: results.length }, 'migrations applied successfully');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }

            return results;
        },

        async down(): Promise<AppliedMigration | undefined> {
            await ensureMigrationsTable(pool);
            const last = await pool.query<{ id: number; name: string; applied_at: Date }>(
                'SELECT id, name, applied_at FROM schema_migrations ORDER BY id DESC LIMIT 1',
            );
            if (last.rows.length === 0) return undefined;

            const row = last.rows[0]!;
            const allFiles = await loadMigrationFiles(opts.migrationsPath);
            const migration = allFiles.find((m) => m.name === row.name);
            if (!migration) {
                throw new Error(`Migration file not found for applied migration: ${row.name}`);
            }

            log.info({ migration: row.name }, 'rolling back migration');
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                if (migration.down) {
                    await client.query(migration.down);
                }
                await client.query('DELETE FROM schema_migrations WHERE id = $1', [row.id]);
                await client.query('COMMIT');
                log.info({ migration: row.name }, 'migration rolled back successfully');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }

            return { id: row.id, name: row.name, appliedAt: row.applied_at };
        },
    };
}
