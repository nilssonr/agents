import { describe, expect, it } from 'vitest';

import { createActivityLogger } from './activity-logger.js';

describe('ActivityLogger', () => {
    it('collects info entries', () => {
        const logger = createActivityLogger();
        logger.info('hello');
        expect(logger.entries()).toEqual([{ level: 'info', message: 'hello', metadata: undefined }]);
    });

    it('collects warn and error entries', () => {
        const logger = createActivityLogger();
        logger.warn('slow', { ms: 500 });
        logger.error('failed', { code: 'ERR' });
        expect(logger.entries()).toHaveLength(2);
        expect(logger.entries()[0]!.level).toBe('warn');
        expect(logger.entries()[1]!.level).toBe('error');
    });

    it('starts empty', () => {
        const logger = createActivityLogger();
        expect(logger.entries()).toEqual([]);
    });
});
