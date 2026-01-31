import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../index.js';

describe('loadConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should read values from environment variables', () => {
        process.env['DB_HOST'] = 'localhost';
        process.env['DB_PORT'] = '5432';

        const result = loadConfig({
            host: { env: 'DB_HOST' },
            port: { env: 'DB_PORT' },
        });

        expect(result.host).toBe('localhost');
        expect(result.port).toBe('5432');
    });

    it('should use default values when env var is missing', () => {
        const result = loadConfig({
            host: { env: 'DB_HOST', default: 'localhost' },
        });

        expect(result.host).toBe('localhost');
    });

    it('should throw when required env var is missing', () => {
        expect(() =>
            loadConfig({
                host: { env: 'MISSING_VAR' },
            }),
        ).toThrow('Missing required environment variables: MISSING_VAR');
    });

    it('should throw listing all missing required vars', () => {
        expect(() =>
            loadConfig({
                host: { env: 'MISSING_A' },
                port: { env: 'MISSING_B' },
            }),
        ).toThrow('Missing required environment variables: MISSING_A, MISSING_B');
    });

    it('should not throw for optional fields without defaults', () => {
        const result = loadConfig({
            optional: { env: 'NOT_SET', required: false, default: '' },
        });

        expect(result.optional).toBe('');
    });
});
