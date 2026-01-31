import { describe, expect, it, beforeEach } from 'vitest';

import { createFakeAgentRepository } from './fake-agent-repository.js';
import { createFakeJobRepository } from '../jobs/fake-job-repository.js';
import type { AgentRepository } from './agent-repository.js';
import type { JobRepository } from '../jobs/job-repository.js';
import { AgentNotFoundError, AgentPausedError, createAgentService } from './agent-service.js';
import type { AgentService } from './agent-service.js';

describe('AgentService', () => {
    let agentRepo: AgentRepository;
    let jobRepo: JobRepository;
    let service: AgentService;

    beforeEach(() => {
        agentRepo = createFakeAgentRepository();
        jobRepo = createFakeJobRepository();
        service = createAgentService(agentRepo, jobRepo);
    });

    it('creates an agent', async () => {
        const agent = await service.createAgent('test-agent', [{ type: 'noop', params: {} }], 3);
        expect(agent.name).toBe('test-agent');
        expect(agent.status).toBe('active');
        expect(agent.failure_count).toBe(0);
    });

    it('gets an agent by id', async () => {
        const created = await service.createAgent('a', [], 3);
        const found = await service.getAgent(created.id);
        expect(found?.id).toBe(created.id);
    });

    it('lists agents', async () => {
        await service.createAgent('a', [], 3);
        await service.createAgent('b', [], 3);
        const list = await service.listAgents();
        expect(list).toHaveLength(2);
    });

    it('deletes an agent', async () => {
        const agent = await service.createAgent('a', [], 3);
        await service.deleteAgent(agent.id);
        const found = await service.getAgent(agent.id);
        expect(found).toBeNull();
    });

    it('invokes an active agent and creates a job', async () => {
        const agent = await service.createAgent('a', [], 3);
        const job = await service.invokeAgent(agent.id, { foo: 'bar' });
        expect(job.agent_id).toBe(agent.id);
        expect(job.status).toBe('pending');
        expect(job.payload).toEqual({ foo: 'bar' });
    });

    it('throws AgentPausedError when invoking a paused agent', async () => {
        const agent = await service.createAgent('a', [], 3);
        await agentRepo.updateStatus(agent.id, 'paused');
        await expect(service.invokeAgent(agent.id, null)).rejects.toThrow(AgentPausedError);
    });

    it('throws AgentNotFoundError when invoking a nonexistent agent', async () => {
        await expect(service.invokeAgent('nonexistent', null)).rejects.toThrow(AgentNotFoundError);
    });

    it('restarts a paused agent', async () => {
        const agent = await service.createAgent('a', [], 3);
        await agentRepo.updateStatus(agent.id, 'paused');
        await service.restartAgent(agent.id);
        const restarted = await service.getAgent(agent.id);
        expect(restarted?.status).toBe('active');
        expect(restarted?.failure_count).toBe(0);
    });

    it('pauses agent when failure count reaches threshold', async () => {
        const agent = await service.createAgent('a', [], 2);
        await service.handleJobFailure(agent.id);
        const after1 = await service.getAgent(agent.id);
        expect(after1?.status).toBe('active');

        await service.handleJobFailure(agent.id);
        const after2 = await service.getAgent(agent.id);
        expect(after2?.status).toBe('paused');
    });
});
