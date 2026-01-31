import type { CallContext } from 'nice-grpc-common';

import type { DeepPartial, JobAssignment, SubscribeRequest, JobResult, JobAck, WorkerServiceImplementation } from '@agents/contracts';

import type { AgentRow } from '../repositories/types.js';
import type { AgentService } from '../services/agent-service.js';
import type { JobService } from '../services/job-service.js';

export interface WorkerServiceOptions {
    pollIntervalMs: number;
}

export function createWorkerServiceImpl(
    agentService: AgentService,
    jobService: JobService,
    options: WorkerServiceOptions,
): WorkerServiceImplementation {
    return {
        async *subscribeToJobs(
            _request: SubscribeRequest,
            context: CallContext,
        ): AsyncGenerator<DeepPartial<JobAssignment>> {
            while (!context.signal.aborted) {
                const agents = await agentService.listAgents();
                const activeAgents = agents.filter((a: AgentRow) => a.status === 'active');

                for (const agent of activeAgents) {
                    const job = await jobService.claimNextJob(agent.id);
                    if (job) {
                        const activities = Array.isArray(agent.activities)
                            ? (agent.activities as Array<{ type?: string; params?: unknown }>)
                            : [];
                        const activity = activities[0];
                        yield {
                            jobId: job.id,
                            agentId: job.agent_id,
                            activityType: activity?.type ?? 'noop',
                            paramsJson: activity?.params ? JSON.stringify(activity.params) : '{}',
                            payloadJson: job.payload ? JSON.stringify(job.payload) : '',
                        };
                    }
                }

                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(resolve, options.pollIntervalMs);
                    context.signal.addEventListener(
                        'abort',
                        () => {
                            clearTimeout(timer);
                            reject(context.signal.reason);
                        },
                        { once: true },
                    );
                });
            }
        },

        async reportJobResult(request: JobResult): Promise<DeepPartial<JobAck>> {
            if (request.success) {
                const result = request.resultJson ? JSON.parse(request.resultJson) as unknown : null;
                await jobService.completeJob(request.jobId, request.agentId, result);
            } else {
                await jobService.failJob(request.jobId, request.agentId, request.error);
            }
            return { accepted: true };
        },
    };
}
