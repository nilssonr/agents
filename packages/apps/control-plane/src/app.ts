import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { registerAgentRoutes } from './api/rest/agents.js';
import { registerWebhookRoutes } from './api/rest/webhooks.js';
import type { AgentService } from './features/agents/agent-service.js';
import type { JobService } from './features/jobs/job-service.js';

export interface AppDeps {
    agentService: AgentService;
    jobService: JobService;
}

export function buildApp(deps: AppDeps): FastifyInstance {
    const app = Fastify();

    registerAgentRoutes(app, deps);
    registerWebhookRoutes(app, deps);

    return app;
}
