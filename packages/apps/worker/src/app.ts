import { createChannel, createClient } from 'nice-grpc';

import { loadConfig } from '@agents/config';
import { WorkerServiceDefinition } from '@agents/contracts';

import { createActivityRegistry } from './features/activities/activity-registry.js';
import { runWorker } from './adapters/grpc/worker-client.js';

/** The worker application handle with lifecycle methods. */
export interface App {
    start(): Promise<void>;
    shutdown(): void;
}

/**
 * Wires together the worker dependencies — gRPC client and activity registry —
 * and returns an {@link App} handle to start polling for jobs and shut down.
 */
export function createApp(): App {
    const config = loadConfig({
        workerId: { env: 'WORKER_ID', default: `worker-${Date.now().toString(36)}` },
        grpcAddress: { env: 'GRPC_ADDRESS', default: 'localhost:50051' },
    });

    const channel = createChannel(config.grpcAddress);
    const client = createClient(WorkerServiceDefinition, channel);
    const registry = createActivityRegistry();
    const abortController = new AbortController();

    return {
        start(): Promise<void> {
            return runWorker({ workerId: config.workerId, client, registry }, abortController.signal);
        },
        shutdown(): void {
            abortController.abort();
        },
    };
}
