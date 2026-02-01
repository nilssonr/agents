import type { WorkerServiceClient, JobAssignment } from '@agents/contracts';
import { createLogger } from '@agents/logger';

import { createActivityLogger } from '../../features/activities/activity-logger.js';
import type { ActivityRegistry } from '../../features/activities/activity-registry.js';

const logger = createLogger('worker-client');

/** Configuration for connecting a worker to the control-plane's gRPC stream. */
export interface WorkerClientOptions {
    workerId: string;
    client: WorkerServiceClient;
    registry: ActivityRegistry;
    /** Maximum time in milliseconds for a single activity execution. Defaults to 60 000. */
    activityTimeoutMs?: number;
}

const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

/**
 * Subscribes to the control-plane's job stream and processes assignments
 * using the activity registry. Each assignment is executed and the result
 * (success or failure) is reported back over gRPC. Automatically reconnects
 * with exponential backoff on connection failures. Runs until the signal
 * is aborted.
 */
const DEFAULT_ACTIVITY_TIMEOUT_MS = 60_000;

export async function runWorker(options: WorkerClientOptions, signal: AbortSignal): Promise<void> {
    const { workerId, client, registry, activityTimeoutMs = DEFAULT_ACTIVITY_TIMEOUT_MS } = options;
    let retryMs = BASE_RETRY_MS;
    let connected = false;

    while (!signal.aborted) {
        try {
            logger.info({ workerId }, 'subscribing to jobs');
            const stream = client.subscribeToJobs({ workerId, capabilities: [] }, { signal });

            for await (const assignment of stream) {
                connected = true;
                retryMs = BASE_RETRY_MS;
                await processAssignment(assignment, client, registry, activityTimeoutMs);
            }
        } catch (err: unknown) {
            if (signal.aborted) {
                logger.info('worker shutting down');
                return;
            }
            if (connected) {
                logger.warn({ err, retryMs }, 'connection lost, reconnecting');
            } else {
                logger.info({ retryMs }, 'control-plane not ready, retrying');
            }
            await sleep(retryMs, signal);
            retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        }
    }
}

function rejectAfterTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_resolve, reject) => {
        setTimeout(() => { reject(new Error(message)); }, ms);
    });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
}

async function processAssignment(
    assignment: JobAssignment,
    client: WorkerServiceClient,
    registry: ActivityRegistry,
    activityTimeoutMs: number,
): Promise<void> {
    logger.info({ jobId: assignment.jobId, activityType: assignment.activityType }, 'processing job');

    const activity = registry.get(assignment.activityType);
    if (!activity) {
        await client.reportJobResult({
            jobId: assignment.jobId,
            agentId: assignment.agentId,
            success: false,
            resultJson: '',
            error: `Unknown activity type: ${assignment.activityType}`,
            stepId: assignment.stepId ?? '',
            logsJson: '',
        });
        return;
    }

    const activityLogger = createActivityLogger();

    try {
        const params = assignment.paramsJson ? JSON.parse(assignment.paramsJson) as unknown : {};
        const payload = assignment.payloadJson ? JSON.parse(assignment.payloadJson) as unknown : null;
        const context = assignment.contextJson ? JSON.parse(assignment.contextJson) as unknown : {};
        const result = await Promise.race([
            activity(params, payload, context, activityLogger),
            rejectAfterTimeout(activityTimeoutMs, `Activity '${assignment.activityType}' timed out after ${String(activityTimeoutMs)}ms`),
        ]);
        await client.reportJobResult({
            jobId: assignment.jobId,
            agentId: assignment.agentId,
            success: true,
            resultJson: JSON.stringify(result),
            error: '',
            stepId: assignment.stepId ?? '',
            logsJson: JSON.stringify(activityLogger.entries()),
        });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await client.reportJobResult({
            jobId: assignment.jobId,
            agentId: assignment.agentId,
            success: false,
            resultJson: '',
            error: errorMessage,
            stepId: assignment.stepId ?? '',
            logsJson: JSON.stringify(activityLogger.entries()),
        });
    }
}
