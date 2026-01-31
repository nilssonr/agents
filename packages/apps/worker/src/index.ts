import { createChannel, createClient } from 'nice-grpc';

import { loadConfig } from '@agents/config';
import { WorkerServiceDefinition } from '@agents/contracts';
import { createLogger } from '@agents/logger';

import { createActivityRegistry } from './features/activities/activity-registry.js';
import { runWorker } from './adapters/grpc/worker-client.js';

const logger = createLogger('worker');

const config = loadConfig({
    workerId: { env: 'WORKER_ID', default: `worker-${Date.now().toString(36)}` },
    grpcAddress: { env: 'GRPC_ADDRESS', default: 'localhost:50051' },
});

const channel = createChannel(config.grpcAddress);
const client = createClient(WorkerServiceDefinition, channel);
const registry = createActivityRegistry();

const abortController = new AbortController();

logger.info({ workerId: config.workerId, grpcAddress: config.grpcAddress }, 'worker starting');

runWorker({ workerId: config.workerId, client, registry }, abortController.signal).catch((err: unknown) => {
    logger.error({ err }, 'worker error');
    process.exit(1);
});

process.on('SIGINT', () => {
    logger.info('worker shutting down');
    abortController.abort();
});
process.on('SIGTERM', () => {
    logger.info('worker shutting down');
    abortController.abort();
});
