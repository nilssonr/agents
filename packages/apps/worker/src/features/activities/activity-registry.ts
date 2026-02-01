import { createLogger } from '@agents/logger';

const logger = createLogger('activity-registry');

export type ActivityFn = (params: unknown, payload: unknown, context: unknown) => Promise<unknown>;

/** A name-based lookup for activity functions that workers can execute. */
export interface ActivityRegistry {
    register(name: string, fn: ActivityFn): void;
    get(name: string): ActivityFn | undefined;
    has(name: string): boolean;
}

/**
 * Creates an {@link ActivityRegistry} pre-loaded with a built-in `noop` activity.
 * Custom activities can be added via `register()`.
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

    registry.register('noop', async (_params, _payload, _context) => {
        logger.info('noop activity executed');
        return { ok: true };
    });

    return registry;
}
