import { describe, expect, it } from 'vitest';
import { parseMigrationFile } from './migration-parser.js';

describe('parseMigrationFile', () => {
    it('parses file with both up and down sections', () => {
        const content = `-- migrate:up
CREATE TABLE foo (id INT);

-- migrate:down
DROP TABLE foo;`;

        const result = parseMigrationFile(content);
        expect(result.up).toBe('CREATE TABLE foo (id INT);');
        expect(result.down).toBe('DROP TABLE foo;');
    });

    it('throws on missing up marker', () => {
        expect(() => parseMigrationFile('CREATE TABLE foo (id INT);')).toThrow(
            'missing "-- migrate:up" marker',
        );
    });

    it('handles empty down section', () => {
        const content = `-- migrate:up
CREATE TABLE foo (id INT);

-- migrate:down
`;

        const result = parseMigrationFile(content);
        expect(result.up).toBe('CREATE TABLE foo (id INT);');
        expect(result.down).toBe('');
    });

    it('handles missing down section', () => {
        const content = `-- migrate:up
CREATE TABLE foo (id INT);`;

        const result = parseMigrationFile(content);
        expect(result.up).toBe('CREATE TABLE foo (id INT);');
        expect(result.down).toBe('');
    });

    it('ignores content before the up marker', () => {
        const content = `-- some comment
-- migrate:up
CREATE TABLE foo (id INT);

-- migrate:down
DROP TABLE foo;`;

        const result = parseMigrationFile(content);
        expect(result.up).toBe('CREATE TABLE foo (id INT);');
        expect(result.down).toBe('DROP TABLE foo;');
    });
});
