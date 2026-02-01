import type { ActivityLogger } from './activity-logger.js';

/** A function that executes a single activity step within a workflow. */
export type ActivityFn = (
    params: unknown,
    payload: unknown,
    context: unknown,
    logger: ActivityLogger,
) => Promise<unknown>;
