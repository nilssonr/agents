import { describe, expect, it } from 'vitest';

import type { WorkerServiceClient, JobAssignment, JobResult, JobAck } from '@agents/contracts';

import { createActivityRegistry } from '../../features/activities/activity-registry.js';
import { runWorker } from './worker-client.js';

function createFakeClient(
    assignments: JobAssignment[],
    controller: AbortController,
): WorkerServiceClient & { reported: JobResult[] } {
    const reported: JobResult[] = [];

    return {
        reported,
        subscribeToJobs(): AsyncIterable<JobAssignment> {
            return {
                [Symbol.asyncIterator](): AsyncIterator<JobAssignment> {
                    let index = 0;
                    return {
                        async next(): Promise<IteratorResult<JobAssignment>> {
                            if (index < assignments.length) {
                                return { value: assignments[index++]!, done: false };
                            }
                            controller.abort();
                            return { value: undefined as unknown as JobAssignment, done: true };
                        },
                    };
                },
            };
        },
        async reportJobResult(request): Promise<JobAck> {
            reported.push(request as JobResult);
            return { accepted: true };
        },
    };
}

describe('WorkerClient', () => {
    it('processes a job assignment using the activity registry', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        const client = createFakeClient([
            {
                jobId: 'j1',
                agentId: 'a1',
                activityType: 'noop',
                paramsJson: '{}',
                payloadJson: '{"data":"test"}',
            },
        ], controller);

        await runWorker({ workerId: 'w1', client, registry }, controller.signal);

        expect(client.reported).toHaveLength(1);
        expect(client.reported[0]!.success).toBe(true);
        expect(client.reported[0]!.jobId).toBe('j1');
    });

    it('reports failure for unknown activity type', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        const client = createFakeClient([
            {
                jobId: 'j2',
                agentId: 'a1',
                activityType: 'unknown-activity',
                paramsJson: '{}',
                payloadJson: '',
            },
        ], controller);

        await runWorker({ workerId: 'w1', client, registry }, controller.signal);

        expect(client.reported).toHaveLength(1);
        expect(client.reported[0]!.success).toBe(false);
        expect(client.reported[0]!.error).toContain('Unknown activity type');
    });

    it('reports failure when activity throws', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        registry.register('failing', async () => {
            throw new Error('boom');
        });

        const client = createFakeClient([
            {
                jobId: 'j3',
                agentId: 'a1',
                activityType: 'failing',
                paramsJson: '{}',
                payloadJson: '',
            },
        ], controller);

        await runWorker({ workerId: 'w1', client, registry }, controller.signal);

        expect(client.reported).toHaveLength(1);
        expect(client.reported[0]!.success).toBe(false);
        expect(client.reported[0]!.error).toBe('boom');
    });

    it('reconnects after a connection error', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        let callCount = 0;

        const client: WorkerServiceClient & { reported: JobResult[] } = {
            reported: [],
            subscribeToJobs(): AsyncIterable<JobAssignment> {
                callCount++;
                if (callCount === 1) {
                    return {
                        [Symbol.asyncIterator](): AsyncIterator<JobAssignment> {
                            return {
                                async next(): Promise<IteratorResult<JobAssignment>> {
                                    throw new Error('connection refused');
                                },
                            };
                        },
                    };
                }
                return {
                    [Symbol.asyncIterator](): AsyncIterator<JobAssignment> {
                        let sent = false;
                        return {
                            async next(): Promise<IteratorResult<JobAssignment>> {
                                if (!sent) {
                                    sent = true;
                                    return {
                                        value: {
                                            jobId: 'j4',
                                            agentId: 'a1',
                                            activityType: 'noop',
                                            paramsJson: '{}',
                                            payloadJson: '',
                                        },
                                        done: false,
                                    };
                                }
                                controller.abort();
                                return { value: undefined as unknown as JobAssignment, done: true };
                            },
                        };
                    },
                };
            },
            async reportJobResult(request): Promise<JobAck> {
                client.reported.push(request as JobResult);
                return { accepted: true };
            },
        };

        await runWorker({ workerId: 'w1', client, registry }, controller.signal);

        expect(callCount).toBe(2);
        expect(client.reported).toHaveLength(1);
        expect(client.reported[0]!.jobId).toBe('j4');
    });
});
