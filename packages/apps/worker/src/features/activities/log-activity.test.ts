import { describe, expect, it } from 'vitest';

import { createActivityLogger } from './activity-logger.js';
import { createLogActivity } from './log-activity.js';

describe('LogActivity', () => {
    it('logs an info message by default', async () => {
        const logger = createActivityLogger();
        const activity = createLogActivity();

        const result = await activity(
            { message: { type: 'literal', value: 'hello world' } },
            null,
            {},
            logger,
        );

        expect(result).toEqual({ logged: true });
        expect(logger.entries()).toEqual([
            { level: 'info', message: 'hello world', metadata: undefined },
        ]);
    });

    it('logs at a specified level', async () => {
        const logger = createActivityLogger();
        const activity = createLogActivity();

        await activity(
            {
                message: { type: 'literal', value: 'something went wrong' },
                level: { type: 'literal', value: 'error' },
            },
            null,
            {},
            logger,
        );

        expect(logger.entries()[0]!.level).toBe('error');
    });

    it('resolves message from context', async () => {
        const logger = createActivityLogger();
        const activity = createLogActivity();

        await activity(
            { message: { type: 'context', ref: 'msg' } },
            null,
            { msg: 'from context' },
            logger,
        );

        expect(logger.entries()[0]!.message).toBe('from context');
    });
});
