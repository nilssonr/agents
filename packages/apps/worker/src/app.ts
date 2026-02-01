import { createChannel, createClient } from 'nice-grpc';

import { loadConfig } from '@agents/config';
import { WorkerServiceDefinition } from '@agents/contracts';

import { createActivityRegistry } from './features/activities/activity-registry.js';
import { runWorker } from './adapters/grpc/worker-client.js';

/** The worker application handle with lifecycle methods. */
export interface App {
    start(): Promise<void>;
    /** Aborts the worker and waits for in-flight work to complete up to a grace period. */
    shutdown(): Promise<void>;
}

/**
 * Wires together the worker dependencies — gRPC client and activity registry —
 * and returns an {@link App} handle to start polling for jobs and shut down.
 */
export function createApp(): App {
    const config = loadConfig({
        workerId: { env: 'WORKER_ID', default: `worker-${Date.now().toString(36)}` },
        grpcAddress: { env: 'GRPC_ADDRESS' },
        activityTimeoutMs: { env: 'ACTIVITY_TIMEOUT_MS', default: '60000' },
        shutdownGraceMs: { env: 'SHUTDOWN_GRACE_MS', default: '10000' },
    });

    const channel = createChannel(config.grpcAddress);
    const client = createClient(WorkerServiceDefinition, channel);
    const registry = createActivityRegistry();
    const abortController = new AbortController();
    const graceMs = Number(config.shutdownGraceMs);
    let workerPromise: Promise<void> | null = null;

    return {
        start(): Promise<void> {
            workerPromise = runWorker(
                { workerId: config.workerId, client, registry, activityTimeoutMs: Number(config.activityTimeoutMs) },
                abortController.signal,
            );
            return workerPromise;
        },
        async shutdown(): Promise<void> {
            abortController.abort();
            if (workerPromise) {
                await Promise.race([
                    workerPromise,
                    new Promise((resolve) => setTimeout(resolve, graceMs)),
                ]);
            }
        },
    };
}
