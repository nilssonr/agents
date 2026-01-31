import { createChannel, createClient } from 'nice-grpc';

import { loadConfig } from '@agents/config';
import { WorkerServiceDefinition } from '@agents/contracts';

import { createActivityRegistry } from './features/activities/activity-registry.js';
import { runWorker } from './adapters/grpc/worker-client.js';

export interface WorkerApp {
    run(signal: AbortSignal): Promise<void>;
    config: { workerId: string; grpcAddress: string };
}

export function createWorkerApp(): WorkerApp {
    const config = loadConfig({
        workerId: { env: 'WORKER_ID', default: `worker-${Date.now().toString(36)}` },
        grpcAddress: { env: 'GRPC_ADDRESS', default: 'localhost:50051' },
    });

    const channel = createChannel(config.grpcAddress);
    const client = createClient(WorkerServiceDefinition, channel);
    const registry = createActivityRegistry();

    return {
        config,
        run(signal: AbortSignal): Promise<void> {
            return runWorker({ workerId: config.workerId, client, registry }, signal);
        },
    };
}
