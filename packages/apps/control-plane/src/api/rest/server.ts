import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import type { AgentService } from '../../features/agents/agent-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import type { LogService } from '../../features/logs/log-service.js';
import { registerAgentRoutes } from './agents.js';
import { registerHealthRoutes } from './health.js';
import { registerJobRoutes } from './jobs.js';
import { registerWebhookRoutes } from './webhooks.js';
import { createProblemDetail } from './schemas.js';

/** Dependencies required by the REST server to handle requests. */
export interface RestServerDeps {
    agentService: AgentService;
    jobService: JobService;
    logService: LogService;
    /** If provided, enables `/health` and `/ready` endpoints. */
    checkDb?: () => Promise<void>;
}

/** Creates a Fastify instance with all REST route groups registered. */
export async function buildRestServer(deps: RestServerDeps): Promise<FastifyInstance> {
    const app = Fastify();

    await app.register(swagger, {
        openapi: {
            openapi: '3.1.0',
            info: {
                title: 'Agents Control Plane API',
                version: '1.0.0',
                description: 'REST API for managing agents, jobs, triggers, and webhooks.',
            },
            tags: [
                { name: 'Agents', description: 'Agent CRUD and lifecycle' },
                { name: 'Jobs', description: 'Job logs and data' },
                { name: 'Webhooks', description: 'External trigger endpoints' },
                { name: 'Health', description: 'Liveness and readiness probes' },
            ],
        },
    });

    await app.register(swaggerUi, { routePrefix: '/docs' });

    app.setErrorHandler((err: unknown, _request, reply) => {
        if (err instanceof Error && err.name === 'ValidationError') {
            return reply
                .status(400)
                .header('content-type', 'application/problem+json')
                .send(createProblemDetail(400, 'Validation Error', err.message));
        }
        const fastifyErr = err as { validation?: unknown; statusCode?: number; message?: string };
        if (fastifyErr.validation) {
            return reply
                .status(400)
                .header('content-type', 'application/problem+json')
                .send(createProblemDetail(400, 'Validation Error', fastifyErr.message ?? 'Validation failed'));
        }
        throw err;
    });

    registerAgentRoutes(app, deps);
    registerJobRoutes(app, deps);
    registerWebhookRoutes(app, deps);

    if (deps.checkDb) {
        registerHealthRoutes(app, { checkDb: deps.checkDb });
    }

    return app;
}
