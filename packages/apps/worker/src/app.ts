import { createChannel, createClient } from 'nice-grpc';

import { loadConfig } from '@agents/config';
import { WorkerServiceDefinition } from '@agents/contracts';
import { createMetricsServer } from '@agents/metrics';

import { runWorker } from './adapters/grpc/worker-client.js';
import { createActivityRegistry } from './features/activities/activity-registry.js';
import { createWorkerMetrics } from './features/metrics/worker-metrics.js';

/** The worker application handle with lifecycle methods. */
export interface App {
    start(): Promise<void>;
    /** Aborts the worker and waits for in-flight work to complete up to a grace period. */
    shutdown(): Promise<void>;
}

/**
 * Wires together the worker dependencies — gRPC client, activity registry,
 * and metrics — and returns an {@link App} handle to start polling for jobs
 * and shut down.
 */
export function createApp(): App {
    const config = loadConfig({
        workerId: { env: 'WORKER_ID', default: `worker-${Date.now().toString(36)}` },
        grpcAddress: { env: 'GRPC_ADDRESS' },
        activityTimeoutMs: { env: 'ACTIVITY_TIMEOUT_MS', default: '60000' },
        shutdownGraceMs: { env: 'SHUTDOWN_GRACE_MS', default: '10000' },
        metricsPort: { env: 'METRICS_PORT', default: '9090' },
        concurrency: { env: 'WORKER_CONCURRENCY', default: '1' },
    });

    const channel = createChannel(config.grpcAddress);
    const client = createClient(WorkerServiceDefinition, channel);
    const activityRegistry = createActivityRegistry();
    const { metrics, registry: metricsRegistry } = createWorkerMetrics();
    const metricsServer = createMetricsServer(metricsRegistry, Number(config.metricsPort));
    const abortController = new AbortController();
    const graceMs = Number(config.shutdownGraceMs);
    let workerPromise: Promise<void> | null = null;

    return {
        async start(): Promise<void> {
            await metricsServer.start();

            workerPromise = runWorker(
                {
                    workerId: config.workerId,
                    client,
                    registry: activityRegistry,
                    activityTimeoutMs: Number(config.activityTimeoutMs),
                    concurrency: Number(config.concurrency),
                    metrics,
                },
                abortController.signal,
            );
            return workerPromise;
        },
        async shutdown(): Promise<void> {
            abortController.abort();
            await metricsServer.stop();
            if (workerPromise) {
                await Promise.race([
                    workerPromise,
                    new Promise((resolve) => setTimeout(resolve, graceMs)),
                ]);
            }
        },
    };
}
