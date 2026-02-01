import { createLogger } from '@agents/logger';

import { createHttpRequestActivity } from './http-request-activity.js';
import { createLogActivity } from './log-activity.js';
import type { ActivityFn } from './activity-types.js';

export type { ActivityFn } from './activity-types.js';

const logger = createLogger('activity-registry');

/** A name-based lookup for activity functions that workers can execute. */
export interface ActivityRegistry {
    register(name: string, fn: ActivityFn): void;
    get(name: string): ActivityFn | undefined;
    has(name: string): boolean;
}

/**
 * Creates an {@link ActivityRegistry} pre-loaded with built-in activities:
 * `noop`, `http-request`, and `log`. Custom activities can be added via `register()`.
 */
export function createActivityRegistry(): ActivityRegistry {
    const activities = new Map<string, ActivityFn>();

    const registry: ActivityRegistry = {
        register(name, fn): void {
            activities.set(name, fn);
        },
        get(name): ActivityFn | undefined {
            return activities.get(name);
        },
        has(name): boolean {
            return activities.has(name);
        },
    };

    registry.register('noop', async (_params, _payload, _context, _logger) => {
        logger.info('noop activity executed');
        return { ok: true };
    });

    registry.register('http-request', createHttpRequestActivity());
    registry.register('log', createLogActivity());

    return registry;
}
