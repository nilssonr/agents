import type { FastifyInstance } from 'fastify';
import { describe, expect, it, beforeEach } from 'vitest';

import { createAgentService } from '../../features/agents/agent-service.js';
import type { AgentService } from '../../features/agents/agent-service.js';
import { createFakeAgentRepository } from '../../features/agents/fake-agent-repository.js';
import { createFlowService } from '../../features/flows/flow-service.js';
import { createFakeJobRepository } from '../../features/jobs/fake-job-repository.js';
import { createJobService } from '../../features/jobs/job-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import { createFakeLogRepository } from '../../features/logs/fake-log-repository.js';
import { createLogService } from '../../features/logs/log-service.js';

import { buildRestServer } from './server.js';

describe('Agent routes', () => {
    let app: FastifyInstance;
    let agentService: AgentService;
    let jobService: JobService;

    beforeEach(async () => {
        const agentRepo = createFakeAgentRepository();
        const jobRepo = createFakeJobRepository();
        agentService = createAgentService(agentRepo, jobRepo);
        jobService = createJobService(
            jobRepo,
            agentRepo,
            (agentId) => agentService.handleJobFailure(agentId),
            createFlowService(),
        );
        const logService = createLogService(createFakeLogRepository());
        app = await buildRestServer({ agentService, jobService, logService });
    });

    it('POST /agents creates an agent', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/agents',
            payload: { name: 'test', activities: [{ type: 'noop' }], failure_threshold: 5 },
        });
        expect(res.statusCode).toBe(201);
        const body: { name: string; status: string } = res.json();
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
        const body: { id: string } = res.json();
        expect(body.id).toBe(agent.id);
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
        const body: { status: string } = res.json();
        expect(body.status).toBe('pending');
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

    it('PATCH /agents/:id updates an agent', async () => {
        const agent = await agentService.createAgent('a', [{ type: 'noop' }], 3);
        const res = await app.inject({
            method: 'PATCH',
            url: `/agents/${agent.id}`,
            payload: { name: 'updated', activities: [{ type: 'log' }], editor_layout: { nodes: [] } },
        });
        expect(res.statusCode).toBe(200);
        const body: { name: string; activities: unknown; editor_layout: unknown } = res.json();
        expect(body.name).toBe('updated');
        expect(body.activities).toEqual([{ type: 'log' }]);
        expect(body.editor_layout).toEqual({ nodes: [] });
    });

    it('PATCH /agents/:id returns 404 for missing agent', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/agents/nonexistent',
            payload: { name: 'x' },
        });
        expect(res.statusCode).toBe(404);
    });

    it('PATCH /agents/:id with empty body returns 400', async () => {
        const agent = await agentService.createAgent('a', [], 3);
        const res = await app.inject({
            method: 'PATCH',
            url: `/agents/${agent.id}`,
            payload: {},
        });
        expect(res.statusCode).toBe(400);
    });

    it('GET /activities returns activity definitions', async () => {
        const res = await app.inject({ method: 'GET', url: '/activities' });
        expect(res.statusCode).toBe(200);
        const body: { type: string }[] = res.json();
        expect(body.length).toBeGreaterThanOrEqual(3);
        const types = body.map((a) => a.type);
        expect(types).toContain('noop');
        expect(types).toContain('http-request');
        expect(types).toContain('log');
    });

    it('POST /agents with empty body returns 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/agents',
            payload: {},
        });
        expect(res.statusCode).toBe(400);
        const body: { detail: string } = res.json();
        expect(body.detail).toContain('name');
    });

    it('POST /agents with empty name returns 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/agents',
            payload: { name: '' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('GET /agents/:id/jobs?status=invalid returns 400', async () => {
        const agent = await agentService.createAgent('a', [], 3);
        const res = await app.inject({ method: 'GET', url: `/agents/${agent.id}/jobs?status=invalid` });
        expect(res.statusCode).toBe(400);
    });

    it('GET /docs/json returns OpenAPI spec', async () => {
        await app.ready();
        const res = await app.inject({ method: 'GET', url: '/docs/json' });
        expect(res.statusCode).toBe(200);
        const spec: { openapi: string; info: { title: string }; paths: unknown } = res.json();
        expect(spec.openapi).toBe('3.1.0');
        expect(spec.info.title).toBe('Agents Control Plane API');
        expect(spec.paths).toBeDefined();
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
