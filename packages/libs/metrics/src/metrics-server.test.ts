import { Registry, Counter } from 'prom-client';
import { describe, it, expect, afterEach } from 'vitest';

import { createMetricsServer, type MetricsServer } from './metrics-server.js';

describe('MetricsServer', () => {
    let server: MetricsServer | null = null;

    afterEach(async () => {
        if (server) await server.stop();
    });

    it('serves metrics on GET /metrics', async () => {
        const registry = new Registry();
        new Counter({ name: 'test_total', help: 'test', registers: [registry] });
        server = createMetricsServer(registry, 0);
        await server.start();

        const addr = server.address();
        const res = await fetch(`http://127.0.0.1:${String(addr!.port)}/metrics`);
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain('test_total');
    });

    it('returns 404 for other paths', async () => {
        const registry = new Registry();
        server = createMetricsServer(registry, 0);
        await server.start();

        const addr = server.address();
        const res = await fetch(`http://127.0.0.1:${String(addr!.port)}/other`);
        expect(res.status).toBe(404);
    });

    it('stops cleanly', async () => {
        const registry = new Registry();
        server = createMetricsServer(registry, 0);
        await server.start();
        await server.stop();
        server = null;
    });
});
