import { describe, expect, it, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app.js';
import { createAgentService } from '../services/agent-service.js';
import { createJobService } from '../services/job-service.js';
import { createFakeAgentRepository, createFakeJobRepository } from '../testing/fake-repositories.js';
import type { AgentService } from '../services/agent-service.js';
import type { JobService } from '../services/job-service.js';

describe('Agent routes', () => {
    let app: FastifyInstance;
    let agentService: AgentService;
    let jobService: JobService;

    beforeEach(() => {
        const agentRepo = createFakeAgentRepository();
        const jobRepo = createFakeJobRepository();
        agentService = createAgentService(agentRepo, jobRepo);
        jobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure);
        app = buildApp({ agentService, jobService });
    });

    it('POST /agents creates an agent', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/agents',
            payload: { name: 'test', activities: [{ type: 'noop' }], failure_threshold: 5 },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.name).toBe('test');
        expect(body.status).toBe('active');
    });

    it('GET /agents lists agents', async () => {
        await agentService.createAgent('a', [], 3);
        const res = await app.inject({ method: 'GET', url: '/agents' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toHaveLength(1);
    });

    it('GET /agents/:id returns an agent', async () => {
        const agent = await agentService.createAgent('a', [], 3);
        const res = await app.inject({ method: 'GET', url: `/agents/${agent.id}` });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(agent.id);
    });

    it('GET /agents/:id returns 404 for missing agent', async () => {
        const res = await app.inject({ method: 'GET', url: '/agents/nonexistent' });
        expect(res.statusCode).toBe(404);
    });

    it('DELETE /agents/:id returns 204', async () => {
        const agent = await agentService.createAgent('a', [], 3);
        const res = await app.inject({ method: 'DELETE', url: `/agents/${agent.id}` });
        expect(res.statusCode).toBe(204);
    });

    it('POST /agents/:id/invoke returns 202 with job', async () => {
        const agent = await agentService.createAgent('a', [], 3);
        const res = await app.inject({
            method: 'POST',
            url: `/agents/${agent.id}/invoke`,
            payload: { data: 'test' },
        });
        expect(res.statusCode).toBe(202);
        expect(res.json().status).toBe('pending');
    });

    it('POST /agents/:id/invoke returns 409 when paused', async () => {
        const agent = await agentService.createAgent('a', [], 1);
        await agentService.handleJobFailure(agent.id);
        const res = await app.inject({
            method: 'POST',
            url: `/agents/${agent.id}/invoke`,
            payload: {},
        });
        expect(res.statusCode).toBe(409);
    });

    it('POST /agents/:id/restart returns 204', async () => {
        const agent = await agentService.createAgent('a', [], 3);
        const res = await app.inject({ method: 'POST', url: `/agents/${agent.id}/restart` });
        expect(res.statusCode).toBe(204);
    });

    it('GET /agents/:id/jobs returns jobs', async () => {
        const agent = await agentService.createAgent('a', [], 3);
        await agentService.invokeAgent(agent.id, null);
        const res = await app.inject({ method: 'GET', url: `/agents/${agent.id}/jobs` });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toHaveLength(1);
    });

    it('GET /agents/:id/jobs?status=pending filters', async () => {
        const agent = await agentService.createAgent('a', [], 3);
        await agentService.invokeAgent(agent.id, null);
        const res = await app.inject({ method: 'GET', url: `/agents/${agent.id}/jobs?status=pending` });
        expect(res.json()).toHaveLength(1);
        const res2 = await app.inject({ method: 'GET', url: `/agents/${agent.id}/jobs?status=completed` });
        expect(res2.json()).toHaveLength(0);
    });
});
