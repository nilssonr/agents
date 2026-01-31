import { describe, expect, it } from 'vitest';

import type { WorkerServiceClient, JobAssignment, JobResult, JobAck } from '@agents/contracts';

import { createActivityRegistry } from './activity-registry.js';
import { runWorker } from './worker-client.js';

function createFakeClient(assignments: JobAssignment[]): WorkerServiceClient & { reported: JobResult[] } {
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
        const client = createFakeClient([
            {
                jobId: 'j1',
                agentId: 'a1',
                activityType: 'noop',
                paramsJson: '{}',
                payloadJson: '{"data":"test"}',
            },
        ]);

        const controller = new AbortController();
        await runWorker({ workerId: 'w1', client, registry }, controller.signal);

        expect(client.reported).toHaveLength(1);
        expect(client.reported[0]!.success).toBe(true);
        expect(client.reported[0]!.jobId).toBe('j1');
    });

    it('reports failure for unknown activity type', async () => {
        const registry = createActivityRegistry();
        const client = createFakeClient([
            {
                jobId: 'j2',
                agentId: 'a1',
                activityType: 'unknown-activity',
                paramsJson: '{}',
                payloadJson: '',
            },
        ]);

        await runWorker({ workerId: 'w1', client, registry }, new AbortController().signal);

        expect(client.reported).toHaveLength(1);
        expect(client.reported[0]!.success).toBe(false);
        expect(client.reported[0]!.error).toContain('Unknown activity type');
    });

    it('reports failure when activity throws', async () => {
        const registry = createActivityRegistry();
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
        ]);

        await runWorker({ workerId: 'w1', client, registry }, new AbortController().signal);

        expect(client.reported).toHaveLength(1);
        expect(client.reported[0]!.success).toBe(false);
        expect(client.reported[0]!.error).toBe('boom');
    });
});
