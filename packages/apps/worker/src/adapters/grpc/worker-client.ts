import type { WorkerServiceClient, JobAssignment } from '@agents/contracts';
import { createLogger } from '@agents/logger';

import type { ActivityRegistry } from '../../features/activities/activity-registry.js';

const logger = createLogger('worker-client');

/** Configuration for connecting a worker to the control-plane's gRPC stream. */
export interface WorkerClientOptions {
    workerId: string;
    client: WorkerServiceClient;
    registry: ActivityRegistry;
}

/**
 * Subscribes to the control-plane's job stream and processes assignments
 * using the activity registry. Each assignment is executed and the result
 * (success or failure) is reported back over gRPC. Runs until the signal
 * is aborted.
 */
export async function runWorker(options: WorkerClientOptions, signal: AbortSignal): Promise<void> {
    const { workerId, client, registry } = options;

    logger.info({ workerId }, 'subscribing to jobs');

    const stream = client.subscribeToJobs({ workerId, capabilities: [] }, { signal });

    try {
        for await (const assignment of stream) {
            await processAssignment(assignment, client, registry);
        }
    } catch (err: unknown) {
        if (signal.aborted) {
            logger.info('worker shutting down');
            return;
        }
        throw err;
    }
}

async function processAssignment(
    assignment: JobAssignment,
    client: WorkerServiceClient,
    registry: ActivityRegistry,
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
        });
        return;
    }

    try {
        const params = assignment.paramsJson ? JSON.parse(assignment.paramsJson) as unknown : {};
        const payload = assignment.payloadJson ? JSON.parse(assignment.payloadJson) as unknown : null;
        const result = await activity(params, payload);
        await client.reportJobResult({
            jobId: assignment.jobId,
            agentId: assignment.agentId,
            success: true,
            resultJson: JSON.stringify(result),
            error: '',
        });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await client.reportJobResult({
            jobId: assignment.jobId,
            agentId: assignment.agentId,
            success: false,
            resultJson: '',
            error: errorMessage,
        });
    }
}
