import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import type { AgentService } from '../../features/agents/agent-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import type { LogService } from '../../features/logs/log-service.js';
import { registerAgentRoutes } from './agents.js';
import { registerHealthRoutes } from './health.js';
import { registerJobRoutes } from './jobs.js';
import { registerWebhookRoutes } from './webhooks.js';

/** Dependencies required by the REST server to handle requests. */
export interface RestServerDeps {
    agentService: AgentService;
    jobService: JobService;
    logService: LogService;
    /** If provided, enables `/health` and `/ready` endpoints. */
    checkDb?: () => Promise<void>;
}

/** Creates a Fastify instance with all REST route groups registered. */
export function buildRestServer(deps: RestServerDeps): FastifyInstance {
    const app = Fastify();

    app.setErrorHandler((err: unknown, _request, reply) => {
        if (err instanceof Error && err.name === 'ValidationError') {
            return reply.status(400).send({ error: err.message });
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
