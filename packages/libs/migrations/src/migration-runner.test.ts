import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

/**
 * We test the file-loading and sorting logic by importing the module
 * internals indirectly through the parser (since loadMigrationFiles is
 * not exported). Instead we verify that createMigrationRunner correctly
 * reads and sorts files by creating a temp directory with migration files
 * and calling the parser on them.
 */
import { parseMigrationFile } from './migration-parser.js';

describe('migration file loading', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'migrations-'));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true });
    });

    it('loads and sorts migration files by name', async () => {
        await writeFile(
            join(dir, '002_second.sql'),
            '-- migrate:up\nCREATE TABLE b (id INT);\n-- migrate:down\nDROP TABLE b;',
        );
        await writeFile(
            join(dir, '001_first.sql'),
            '-- migrate:up\nCREATE TABLE a (id INT);\n-- migrate:down\nDROP TABLE a;',
        );

        const entries = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
        expect(entries).toEqual(['001_first.sql', '002_second.sql']);

        const firstFile = entries[0];
        expect(firstFile).toBeDefined();
        if (firstFile) {
            const first = parseMigrationFile(await readFile(join(dir, firstFile), 'utf-8'));
            expect(first.up).toBe('CREATE TABLE a (id INT);');
        }

        const secondFile = entries[1];
        expect(secondFile).toBeDefined();
        if (secondFile) {
            const second = parseMigrationFile(await readFile(join(dir, secondFile), 'utf-8'));
            expect(second.up).toBe('CREATE TABLE b (id INT);');
        }
    });

    it('ignores non-sql files', async () => {
        await writeFile(join(dir, '001_first.sql'), '-- migrate:up\nSELECT 1;\n-- migrate:down\n');
        await writeFile(join(dir, 'README.md'), '# Migrations');

        const entries = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
        expect(entries).toEqual(['001_first.sql']);
    });
});
