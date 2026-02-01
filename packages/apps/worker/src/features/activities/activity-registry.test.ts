import { describe, expect, it } from 'vitest';

import { createActivityLogger } from './activity-logger.js';
import { createActivityRegistry } from './activity-registry.js';

describe('ActivityRegistry', () => {
    it('ships with noop activity', () => {
        const registry = createActivityRegistry();
        expect(registry.has('noop')).toBe(true);
    });

    it('ships with log activity', () => {
        const registry = createActivityRegistry();
        expect(registry.has('log')).toBe(true);
    });

    it('noop activity returns ok', async () => {
        const registry = createActivityRegistry();
        const noop = registry.get('noop');
        expect(noop).toBeDefined();
        const result = await noop!({}, null, {}, createActivityLogger());
        expect(result).toEqual({ ok: true });
    });

    it('registers and retrieves a custom activity', () => {
        const registry = createActivityRegistry();
        const fn = async (): Promise<string> => 'done';
        registry.register('custom', fn);
        expect(registry.get('custom')).toBe(fn);
    });

    it('returns undefined for unknown activity', () => {
        const registry = createActivityRegistry();
        expect(registry.get('unknown')).toBeUndefined();
    });
});
