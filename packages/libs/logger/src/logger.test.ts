import { describe, expect, it } from 'vitest';

import { createLogger } from './index.js';

describe('createLogger', () => {
    it('should create a pino logger instance', () => {
        const logger = createLogger('test');
        expect(logger).toBeDefined();
        expect(logger.info).toBeTypeOf('function');
        expect(logger.error).toBeTypeOf('function');
        expect(logger.warn).toBeTypeOf('function');
    });

    it('should set the logger name', () => {
        const logger = createLogger('my-service');
        expect(logger.bindings()['name']).toBe('my-service');
    });

    it('should default to info level', () => {
        const logger = createLogger('test');
        expect(logger.level).toBe('info');
    });

    it('should accept a custom level', () => {
        const logger = createLogger('test', 'debug');
        expect(logger.level).toBe('debug');
    });
});
