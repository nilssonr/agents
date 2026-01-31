/** Result of parsing a migration file into up and down SQL sections. */
export interface ParsedMigration {
    up: string;
    down: string;
}

/**
 * Parses a migration file content into up and down SQL sections.
 * Splits on `-- migrate:up` and `-- migrate:down` markers.
 * Throws if the `-- migrate:up` marker is missing.
 */
export function parseMigrationFile(content: string): ParsedMigration {
    const upIndex = content.indexOf('-- migrate:up');
    if (upIndex === -1) {
        throw new Error('Migration file is missing "-- migrate:up" marker');
    }

    const afterUp = content.slice(upIndex + '-- migrate:up'.length);
    const downIndex = afterUp.indexOf('-- migrate:down');

    if (downIndex === -1) {
        return { up: afterUp.trim(), down: '' };
    }

    const up = afterUp.slice(0, downIndex).trim();
    const down = afterUp.slice(downIndex + '-- migrate:down'.length).trim();

    return { up, down };
}
