/* eslint-disable @typescript-eslint/require-await */
import type { WorkerServiceClient, JobAssignment, JobResult, JobAck } from '@agents/contracts';
import { describe, expect, it } from 'vitest';

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
                                const value = assignments[index++];
                                if (value) {
                                    return { value, done: false };
                                }
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
        const client = createFakeClient(
            [
                {
                    jobId: 'j1',
                    agentId: 'a1',
                    activityType: 'noop',
                    paramsJson: '{}',
                    payloadJson: '{"data":"test"}',
                    stepId: 'step_0',
                    contextJson: '{}',
                },
            ],
            controller,
        );

        await runWorker({ workerId: 'w1', client, registry }, controller.signal);

        expect(client.reported).toHaveLength(1);
        const firstReport = client.reported[0];
        expect(firstReport).toBeDefined();
        expect(firstReport?.success).toBe(true);
        expect(firstReport?.jobId).toBe('j1');
    });

    it('reports failure for unknown activity type', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        const client = createFakeClient(
            [
                {
                    jobId: 'j2',
                    agentId: 'a1',
                    activityType: 'unknown-activity',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
            ],
            controller,
        );

        await runWorker({ workerId: 'w1', client, registry }, controller.signal);

        expect(client.reported).toHaveLength(1);
        const firstReport = client.reported[0];
        expect(firstReport).toBeDefined();
        expect(firstReport?.success).toBe(false);
        expect(firstReport?.error).toContain('Unknown activity type');
    });

    it('reports failure when activity throws', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        registry.register('failing', async () => {
            throw new Error('boom');
        });

        const client = createFakeClient(
            [
                {
                    jobId: 'j3',
                    agentId: 'a1',
                    activityType: 'failing',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
            ],
            controller,
        );

        await runWorker({ workerId: 'w1', client, registry }, controller.signal);

        expect(client.reported).toHaveLength(1);
        const firstReport = client.reported[0];
        expect(firstReport).toBeDefined();
        expect(firstReport?.success).toBe(false);
        expect(firstReport?.error).toBe('boom');
    });

    it('reports failure when activity exceeds timeout', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        registry.register('slow', async () => {
            return new Promise(() => {
                // never resolves
            });
        });

        const client = createFakeClient(
            [
                {
                    jobId: 'j-timeout',
                    agentId: 'a1',
                    activityType: 'slow',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
            ],
            controller,
        );

        await runWorker({ workerId: 'w1', client, registry, activityTimeoutMs: 50 }, controller.signal);

        expect(client.reported).toHaveLength(1);
        const firstReport = client.reported[0];
        expect(firstReport).toBeDefined();
        expect(firstReport?.success).toBe(false);
        expect(firstReport?.error).toContain('timed out');
    });

    it('completes in-flight activity before shutting down', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        let activityResolved = false;

        registry.register('delayed', async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            activityResolved = true;
            return { done: true };
        });

        const client = createFakeClient(
            [
                {
                    jobId: 'j-drain',
                    agentId: 'a1',
                    activityType: 'delayed',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
            ],
            controller,
        );

        const workerPromise = runWorker({ workerId: 'w1', client, registry }, controller.signal);

        // Give time for the activity to start, then abort
        await new Promise((resolve) => setTimeout(resolve, 20));
        controller.abort();

        await workerPromise;

        expect(activityResolved).toBe(true);
        expect(client.reported).toHaveLength(1);
        const firstReport = client.reported[0];
        expect(firstReport).toBeDefined();
        expect(firstReport?.success).toBe(true);
    });

    it('processes assignments concurrently with concurrency > 1', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        let maxConcurrent = 0;
        let currentConcurrent = 0;

        registry.register('concurrent', async () => {
            currentConcurrent++;
            if (currentConcurrent > maxConcurrent) maxConcurrent = currentConcurrent;
            await new Promise((resolve) => setTimeout(resolve, 50));
            currentConcurrent--;
            return { ok: true };
        });

        const client = createFakeClient(
            [
                {
                    jobId: 'c1',
                    agentId: 'a1',
                    activityType: 'concurrent',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
                {
                    jobId: 'c2',
                    agentId: 'a1',
                    activityType: 'concurrent',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
                {
                    jobId: 'c3',
                    agentId: 'a1',
                    activityType: 'concurrent',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
            ],
            controller,
        );

        await runWorker({ workerId: 'w1', client, registry, concurrency: 2 }, controller.signal);

        expect(client.reported).toHaveLength(3);
        expect(maxConcurrent).toBe(2);
    });

    it('processes assignments sequentially with concurrency 1', async () => {
        const registry = createActivityRegistry();
        const controller = new AbortController();
        let maxConcurrent = 0;
        let currentConcurrent = 0;

        registry.register('seq', async () => {
            currentConcurrent++;
            if (currentConcurrent > maxConcurrent) maxConcurrent = currentConcurrent;
            await new Promise((resolve) => setTimeout(resolve, 10));
            currentConcurrent--;
            return { ok: true };
        });

        const client = createFakeClient(
            [
                {
                    jobId: 's1',
                    agentId: 'a1',
                    activityType: 'seq',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
                {
                    jobId: 's2',
                    agentId: 'a1',
                    activityType: 'seq',
                    paramsJson: '{}',
                    payloadJson: '',
                    stepId: '',
                    contextJson: '{}',
                },
            ],
            controller,
        );

        await runWorker({ workerId: 'w1', client, registry, concurrency: 1 }, controller.signal);

        expect(client.reported).toHaveLength(2);
        expect(maxConcurrent).toBe(1);
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
                                            stepId: '',
                                            contextJson: '{}',
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
        const firstReport = client.reported[0];
        expect(firstReport).toBeDefined();
        expect(firstReport?.jobId).toBe('j4');
    });
});
