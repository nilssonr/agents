import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

import { registerHealthRoutes } from './health.js';

describe('Health routes', () => {
    it('GET /health returns 200 with ok status', async () => {
        const app = Fastify();
        registerHealthRoutes(app, { checkDb: () => Promise.resolve() });

        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ status: 'ok' });
    });

    it('GET /ready returns 200 when DB is reachable', async () => {
        const app = Fastify();
        registerHealthRoutes(app, { checkDb: () => Promise.resolve() });

        const res = await app.inject({ method: 'GET', url: '/ready' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ status: 'ok' });
    });

    it('GET /ready returns 503 when DB check fails', async () => {
        const app = Fastify();
        const checkDb = vi.fn().mockRejectedValue(new Error('connection refused'));
        registerHealthRoutes(app, { checkDb });

        const res = await app.inject({ method: 'GET', url: '/ready' });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ status: 'unavailable', error: 'connection refused' });
    });
});
