import { describe, expect, it, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildRestServer } from './server.js';
import { createAgentService } from '../../features/agents/agent-service.js';
import { createJobService } from '../../features/jobs/job-service.js';
import { createFlowService } from '../../features/flows/flow-service.js';
import { createFakeAgentRepository } from '../../features/agents/fake-agent-repository.js';
import { createFakeJobRepository } from '../../features/jobs/fake-job-repository.js';
import type { AgentService } from '../../features/agents/agent-service.js';
import type { JobService } from '../../features/jobs/job-service.js';

describe('Webhook routes', () => {
    let app: FastifyInstance;
    let agentService: AgentService;

    beforeEach(() => {
        const agentRepo = createFakeAgentRepository();
        const jobRepo = createFakeJobRepository();
        agentService = createAgentService(agentRepo, jobRepo);
        const jobService: JobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure, createFlowService());
        app = buildRestServer({ agentService, jobService });
    });

    it('POST /webhooks/:agentId returns 202 and stores payload', async () => {
        const agent = await agentService.createAgent('webhook-agent', [], 3);
        const res = await app.inject({
            method: 'POST',
            url: `/webhooks/${agent.id}`,
            payload: { event: 'push', repo: 'test' },
        });
        expect(res.statusCode).toBe(202);
        expect(res.json().payload).toEqual({ event: 'push', repo: 'test' });
    });

    it('POST /webhooks/:agentId returns 404 for unknown agent', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/webhooks/nonexistent',
            payload: {},
        });
        expect(res.statusCode).toBe(404);
    });

    it('POST /webhooks/:agentId returns 409 when agent is paused', async () => {
        const agent = await agentService.createAgent('a', [], 1);
        await agentService.handleJobFailure(agent.id);
        const res = await app.inject({
            method: 'POST',
            url: `/webhooks/${agent.id}`,
            payload: {},
        });
        expect(res.statusCode).toBe(409);
    });
});
