import type { FastifyInstance } from 'fastify';
import type { Registry } from 'prom-client';

/** Registers the `GET /metrics` endpoint that returns Prometheus-formatted metrics. */
export function registerMetricsRoute(app: FastifyInstance, registry: Registry): void {
    app.get('/metrics', async (_request, reply) => {
        const output = await registry.metrics();
        void reply.header('content-type', registry.contentType);
        return output;
    });
}
