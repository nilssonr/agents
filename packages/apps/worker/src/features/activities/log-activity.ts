/* eslint-disable @typescript-eslint/require-await */
import { z } from 'zod';

import type { ActivityFn } from './activity-types.js';
import { resolveValue, valueSourceSchema } from './value-source.js';

const LOG_LEVELS = ['info', 'warn', 'error'] as const;

/** Zod schema for log activity parameters. */
export const logActivityParamsSchema = z.object({
    message: valueSourceSchema(z.string()),
    level: valueSourceSchema(z.enum(LOG_LEVELS)).optional(),
});

/**
 * Creates an activity that emits a log entry via the activity logger.
 * Useful as an explicit `log` step in multi-step flows.
 */
export function createLogActivity(): ActivityFn {
    return async (_params: unknown, _payload: unknown, context: unknown, logger): Promise<{ logged: boolean }> => {
        const parsed = logActivityParamsSchema.parse(_params);
        const message = resolveValue(parsed.message, context);
        const level = parsed.level ? resolveValue(parsed.level, context) : 'info';
        logger[level](message);
        return { logged: true };
    };
}
