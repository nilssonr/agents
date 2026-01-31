import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createServer, createChannel, createClient } from 'nice-grpc';
import type { Server, ServiceImplementation } from 'nice-grpc';

import { WorkerServiceDefinition } from '@agents/contracts';
import type { WorkerServiceClient } from '@agents/contracts';

import { createAgentService } from '../services/agent-service.js';
import { createJobService } from '../services/job-service.js';
import { createFakeAgentRepository, createFakeJobRepository } from '../testing/fake-repositories.js';
import type { AgentService } from '../services/agent-service.js';
import type { JobService } from '../services/job-service.js';
import { createWorkerServiceImpl } from './worker-service-impl.js';

describe('WorkerService gRPC', () => {
    let server: Server;
    let client: WorkerServiceClient;
    let agentService: AgentService;
    let jobService: JobService;
    let port: number;

    beforeEach(async () => {
        const agentRepo = createFakeAgentRepository();
        const jobRepo = createFakeJobRepository();
        agentService = createAgentService(agentRepo, jobRepo);
        jobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure);

        const impl = createWorkerServiceImpl(agentService, jobService, { pollIntervalMs: 50 });
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
        const first = assignments[0] as { agentId: string; activityType: string };
        expect(first.agentId).toBe(agent.id);
        expect(first.activityType).toBe('noop');
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
        });

        const jobs = await jobService.getJobsForAgent(agent.id, 'failed');
        expect(jobs).toHaveLength(1);
    });
});
