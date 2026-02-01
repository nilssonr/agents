import type { FastifyInstance } from 'fastify';

/** Dependencies required by the health check routes. */
export interface HealthDeps {
    checkDb: () => Promise<void>;
}

/** Registers liveness (`/health`) and readiness (`/ready`) endpoints. */
export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
    app.get('/health', async () => ({ status: 'ok' }));

    app.get('/ready', async (_request, reply) => {
        try {
            await deps.checkDb();
            return { status: 'ok' };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return reply.status(503).send({ status: 'unavailable', error: message });
        }
    });
}
