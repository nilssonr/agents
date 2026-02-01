import type {
    DeepPartial,
    JobAssignment,
    SubscribeRequest,
    JobResult,
    JobAck,
    WorkerServiceImplementation,
} from '@agents/contracts';
import type { CallContext } from 'nice-grpc-common';

import type { AgentRow } from '../../features/agents/agent-repository.js';
import type { AgentService } from '../../features/agents/agent-service.js';
import type { FlowService } from '../../features/flows/flow-service.js';
import type { JobRepository } from '../../features/jobs/job-repository.js';
import type { JobService } from '../../features/jobs/job-service.js';
import type { LogService } from '../../features/logs/log-service.js';

/** Configuration for the gRPC WorkerService server-side implementation. */
export interface WorkerServiceOptions {
    pollIntervalMs: number;
    /** Optional metrics to increment on job assignments. */
    metrics?: { grpcAssignments: { inc(): void } };
}

/**
 * Builds the server-side gRPC WorkerService implementation.
 *
 * `subscribeToJobs` polls all active agents for pending jobs at a fixed interval
 * and streams assignments to connected workers. `reportJobResult` processes
 * completion or failure results reported back by workers.
 */
export function createWorkerServiceImpl(
    agentService: AgentService,
    jobService: JobService,
    jobRepo: JobRepository,
    flowService: FlowService,
    logService: LogService,
    options: WorkerServiceOptions,
): WorkerServiceImplementation {
    return {
        async *subscribeToJobs(
            request: SubscribeRequest,
            context: CallContext,
        ): AsyncGenerator<DeepPartial<JobAssignment>> {
            const capabilities = new Set(request.capabilities);

            while (!context.signal.aborted) {
                const agents = await agentService.listAgents();
                const activeAgents = agents.filter((a: AgentRow) => a.status === 'active');

                for (const agent of activeAgents) {
                    // Skip agents whose first activity type is not in the worker's capabilities
                    if (capabilities.size > 0) {
                        const agentActivities = Array.isArray(agent.activities)
                            ? (agent.activities as Array<{ type?: string }>)
                            : [];
                        const firstStep = agentActivities.at(0);
                        if (firstStep) {
                            const stepType = firstStep.type ?? '';
                            if (!capabilities.has(stepType)) {
                                continue;
                            }
                        }
                    }
                    const job = await jobService.claimNextJob(agent.id);
                    if (job) {
                        const activities = Array.isArray(agent.activities)
                            ? (agent.activities as Array<{ type?: string; params?: unknown }>)
                            : [];

                        let stepId = job.current_step_id;
                        const stepContext = job.context;

                        // If no current step, initialize the flow
                        if (!stepId) {
                            const initialStep = flowService.getInitialStep(activities);
                            if (initialStep) {
                                stepId = initialStep.id;
                                await jobRepo.updateStep(job.id, stepId, stepContext);
                            }
                        }

                        const step = stepId
                            ? activities.find(
                                  (a: Record<string, unknown>) =>
                                      a.id === stepId || (activities.indexOf(a) === 0 && !a.id),
                              )
                            : activities[0];

                        // Find the step by parsed flow steps for accurate params
                        const { findStepById } = await import('../../features/flows/flow-parser.js');
                        const { parseFlowSteps } = await import('../../features/flows/flow-parser.js');
                        const parsedSteps = parseFlowSteps(activities);
                        const currentStep = stepId ? findStepById(parsedSteps, stepId) : null;

                        yield {
                            jobId: job.id,
                            agentId: job.agent_id,
                            activityType: currentStep?.type ?? step?.type ?? 'noop',
                            paramsJson: currentStep?.params
                                ? JSON.stringify(currentStep.params)
                                : step?.params
                                  ? JSON.stringify(step.params)
                                  : '{}',
                            payloadJson: job.payload ? JSON.stringify(job.payload) : '',
                            stepId: stepId ?? '',
                            contextJson: JSON.stringify(stepContext),
                            stepLabel: currentStep?.label ?? '',
                        };
                        options.metrics?.grpcAssignments.inc();
                    }
                }

                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(resolve, options.pollIntervalMs);
                    context.signal.addEventListener(
                        'abort',
                        () => {
                            clearTimeout(timer);
                            reject(new Error(context.signal.reason as string));
                        },
                        { once: true },
                    );
                });
            }
        },

        async reportJobResult(request: JobResult): Promise<DeepPartial<JobAck>> {
            // Persist any logs sent by the worker
            if (request.logsJson) {
                try {
                    const entries = JSON.parse(request.logsJson) as Array<{
                        level: string;
                        message: string;
                        metadata?: unknown;
                    }>;
                    if (entries.length > 0) {
                        await logService.appendLogs(
                            request.jobId,
                            entries.map((e) => ({
                                step_id: request.stepId || null,
                                level: e.level,
                                message: e.message,
                                metadata: e.metadata,
                            })),
                        );
                    }
                } catch {
                    // Ignore malformed logs_json
                }
            }

            if (request.stepId) {
                // Flow-aware path
                const agent = await agentService.getAgent(request.agentId);
                if (!agent) {
                    return { accepted: false };
                }
                const result = request.resultJson ? (JSON.parse(request.resultJson) as unknown) : null;
                await jobService.processStepResult(
                    request.jobId,
                    request.agentId,
                    request.stepId,
                    request.success,
                    result,
                    request.success ? undefined : request.error,
                    agent.activities,
                );
            } else if (request.success) {
                const result = request.resultJson ? (JSON.parse(request.resultJson) as unknown) : null;
                await jobService.completeJob(request.jobId, request.agentId, result);
            } else {
                await jobService.failJob(request.jobId, request.agentId, request.error);
            }
            return { accepted: true };
        },
    };
}
