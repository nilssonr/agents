import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import type { AgentService } from '../../features/agents/agent-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import { registerAgentRoutes } from './agents.js';
import { registerWebhookRoutes } from './webhooks.js';

export interface RestServerDeps {
    agentService: AgentService;
    jobService: JobService;
}

export function buildRestServer(deps: RestServerDeps): FastifyInstance {
    const app = Fastify();

    registerAgentRoutes(app, deps);
    registerWebhookRoutes(app, deps);

    return app;
}
