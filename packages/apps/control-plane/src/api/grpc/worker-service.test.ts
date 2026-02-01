import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createServer, createChannel, createClient } from 'nice-grpc';
import type { Server, ServiceImplementation } from 'nice-grpc';

import { WorkerServiceDefinition } from '@agents/contracts';
import type { WorkerServiceClient } from '@agents/contracts';

import { createAgentService } from '../../features/agents/agent-service.js';
import { createJobService } from '../../features/jobs/job-service.js';
import { createFlowService } from '../../features/flows/flow-service.js';
import { createFakeAgentRepository } from '../../features/agents/fake-agent-repository.js';
import { createFakeJobRepository } from '../../features/jobs/fake-job-repository.js';
import type { AgentService } from '../../features/agents/agent-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import { createWorkerServiceImpl } from './worker-service-impl.js';

describe('WorkerService gRPC', () => {
    let server: Server;
    let client: WorkerServiceClient;
    let agentService: AgentService;
    let jobService: JobService;
    let jobRepo: ReturnType<typeof createFakeJobRepository>;
    let port: number;

    beforeEach(async () => {
        const agentRepo = createFakeAgentRepository();
        jobRepo = createFakeJobRepository();
        agentService = createAgentService(agentRepo, jobRepo);
        const flowService = createFlowService();
        jobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure, flowService);

        const impl = createWorkerServiceImpl(agentService, jobService, jobRepo, flowService, { pollIntervalMs: 50 });
        server = createServer();
        server.add(
            WorkerServiceDefinition,
            impl as unknown as ServiceImplementation<typeof WorkerServiceDefinition>,
        );
        port = await server.listen('127.0.0.1:0');
        const channel = createChannel(`127.0.0.1:${String(port)}`);
        client = createClient(WorkerServiceDefinition, channel);
    });

    afterEach(async () => {
        await server.shutdown();
    });

    it('streams a job assignment when a job is pending', async () => {
        const agent = await agentService.createAgent('a', [{ type: 'noop', params: {} }], 3);
        await agentService.invokeAgent(agent.id, { hello: 'world' });

        const abortController = new AbortController();
        const stream = client.subscribeToJobs({ workerId: 'w1', capabilities: [] }, { signal: abortController.signal });

        const assignments: unknown[] = [];
        try {
            for await (const assignment of stream) {
                assignments.push(assignment);
                abortController.abort();
            }
        } catch {
            // Expected abort error
        }

        expect(assignments).toHaveLength(1);
        const first = assignments[0] as { agentId: string; activityType: string; stepId: string };
        expect(first.agentId).toBe(agent.id);
        expect(first.activityType).toBe('noop');
        expect(first.stepId).toBe('step_0');
    });

    it('reportJobResult completes a job', async () => {
        const agent = await agentService.createAgent('a', [{ type: 'noop', params: {} }], 3);
        const job = await agentService.invokeAgent(agent.id, null);
        await jobService.claimNextJob(agent.id);

        const ack = await client.reportJobResult({
            jobId: job.id,
            agentId: agent.id,
            success: true,
            resultJson: '{"done":true}',
            error: '',
            stepId: '',
        });
        expect(ack.accepted).toBe(true);

        const jobs = await jobService.getJobsForAgent(agent.id, 'completed');
        expect(jobs).toHaveLength(1);
    });

    it('reportJobResult fails a job', async () => {
        const agent = await agentService.createAgent('a', [{ type: 'noop', params: {} }], 3);
        const job = await agentService.invokeAgent(agent.id, null);
        await jobService.claimNextJob(agent.id);

        await client.reportJobResult({
            jobId: job.id,
            agentId: agent.id,
            success: false,
            resultJson: '',
            error: 'boom',
            stepId: '',
        });

        const jobs = await jobService.getJobsForAgent(agent.id, 'failed');
        expect(jobs).toHaveLength(1);
    });

    it('processes a multi-step flow', async () => {
        const activities = [
            { id: 'fetch', type: 'noop', params: {} },
            { id: 'transform', type: 'noop', params: {} },
        ];
        const agent = await agentService.createAgent('flow-agent', activities, 3);
        await agentService.invokeAgent(agent.id, { input: 'data' });

        // Claim and get first assignment
        const abortController = new AbortController();
        const stream = client.subscribeToJobs({ workerId: 'w1', capabilities: [] }, { signal: abortController.signal });

        let firstAssignment: Record<string, unknown> | undefined;
        try {
            for await (const assignment of stream) {
                firstAssignment = assignment as unknown as Record<string, unknown>;
                abortController.abort();
            }
        } catch {
            // Expected
        }

        expect(firstAssignment).toBeDefined();
        expect(firstAssignment!.stepId).toBe('fetch');

        // Report success with next step
        await client.reportJobResult({
            jobId: firstAssignment!.jobId as string,
            agentId: agent.id,
            success: true,
            resultJson: JSON.stringify({ next: 'transform', data: 'fetched' }),
            error: '',
            stepId: 'fetch',
        });

        // Job should now be pending with step_id = transform
        const pendingJobs = await jobService.getJobsForAgent(agent.id, 'pending');
        expect(pendingJobs).toHaveLength(1);
        expect(pendingJobs[0]!.current_step_id).toBe('transform');
    });
});
