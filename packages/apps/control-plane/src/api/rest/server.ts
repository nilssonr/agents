import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { Registry } from 'prom-client';

import type { AgentService } from '../../features/agents/agent-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import type { LogService } from '../../features/logs/log-service.js';
import { registerAgentRoutes } from './agents.js';
import { registerHealthRoutes } from './health.js';
import { registerJobRoutes } from './jobs.js';
import { registerMetricsRoute } from './metrics-route.js';
import { registerWebhookRoutes } from './webhooks.js';

/** Dependencies required by the REST server to handle requests. */
export interface RestServerDeps {
    agentService: AgentService;
    jobService: JobService;
    logService: LogService;
    /** If provided, enables `/health` and `/ready` endpoints. */
    checkDb?: () => Promise<void>;
    /** If provided, enables the `/metrics` endpoint. */
    metricsRegistry?: Registry;
}

/** Creates a Fastify instance with all REST route groups registered. */
export function buildRestServer(deps: RestServerDeps): FastifyInstance {
    const app = Fastify();

    registerAgentRoutes(app, deps);
    registerJobRoutes(app, deps);
    registerWebhookRoutes(app, deps);

    if (deps.checkDb) {
        registerHealthRoutes(app, { checkDb: deps.checkDb });
    }

    if (deps.metricsRegistry) {
        registerMetricsRoute(app, deps.metricsRegistry);
    }

    return app;
}
