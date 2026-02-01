import type { FastifyInstance } from 'fastify';

import { healthSchema, readyErrorSchema, toJsonSchema, createProblemDetail } from './schemas.js';

/** Dependencies required by the health check routes. */
export interface HealthDeps {
    checkDb: () => Promise<void>;
}

/** Registers liveness (`/health`) and readiness (`/ready`) endpoints. */
export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
    app.get(
        '/health',
        {
            schema: {
                tags: ['Health'],
                description: 'Liveness probe',
                response: { 200: toJsonSchema(healthSchema) },
            },
        },
        (): { status: string } => ({ status: 'ok' }),
    );

    app.get(
        '/ready',
        {
            schema: {
                tags: ['Health'],
                description: 'Readiness probe (checks database connectivity)',
                response: {
                    200: toJsonSchema(healthSchema),
                    503: toJsonSchema(readyErrorSchema),
                },
            },
        },
        async (_request, reply) => {
            try {
                await deps.checkDb();
                return { status: 'ok' };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return reply.status(503).send(createProblemDetail(503, 'Service Unavailable', message));
            }
        },
    );
}
