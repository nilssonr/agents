import type { WorkerServiceClient, JobAssignment } from '@agents/contracts';
import { createLogger } from '@agents/logger';
import { ZodError } from 'zod';

import { createActivityLogger } from '../../features/activities/activity-logger.js';
import type { ActivityRegistry } from '../../features/activities/activity-registry.js';
import type { WorkerMetrics } from '../../features/metrics/worker-metrics.js';

const logger = createLogger('worker-client');

/** Configuration for connecting a worker to the control-plane's gRPC stream. */
export interface WorkerClientOptions {
    workerId: string;
    client: WorkerServiceClient;
    registry: ActivityRegistry;
    /** Maximum time in milliseconds for a single activity execution. Defaults to 60 000. */
    activityTimeoutMs?: number;
    /** Optional worker metrics for activity instrumentation. */
    metrics?: WorkerMetrics;
    /** Maximum number of concurrent activity executions. Defaults to 1. */
    concurrency?: number;
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
    const {
        workerId,
        client,
        registry,
        activityTimeoutMs = DEFAULT_ACTIVITY_TIMEOUT_MS,
        metrics,
        concurrency = 1,
    } = options;
    let retryMs = BASE_RETRY_MS;
    let connected = false;

    while (!signal.aborted) {
        try {
            logger.info({ workerId }, 'subscribing to jobs');
            const stream = client.subscribeToJobs({ workerId, capabilities: registry.listNames() }, { signal });

            let inFlight = 0;
            const pending: Promise<void>[] = [];

            for await (const assignment of stream) {
                if (!connected) {
                    connected = true;
                    metrics?.connected.set(1);
                }
                retryMs = BASE_RETRY_MS;

                // Wait if at capacity
                while (inFlight >= concurrency && pending.length > 0) {
                    await Promise.race(pending);
                }

                inFlight++;
                const p = processAssignment(assignment, client, registry, activityTimeoutMs, metrics);
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                p.finally(() => {
                    inFlight--;
                    const index = pending.indexOf(p);
                    if (index >= 0) {
                        void pending.splice(index, 1);
                    }
                });
                pending.push(p);
            }

            // Wait for all in-flight to finish
            await Promise.allSettled(pending);
        } catch (err: unknown) {
            // Check if we're shutting down (signal.aborted can be true if abort happened during stream)
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
                logger.info('worker shutting down');
                metrics?.connected.set(0);
                return;
            }
            if (connected) {
                logger.warn({ err, retryMs }, 'connection lost, reconnecting');
                connected = false;
                metrics?.connected.set(0);
            } else {
                logger.info({ retryMs }, 'control-plane not ready, retrying');
            }
            metrics?.reconnectsTotal.inc();
            await sleep(retryMs, signal);
            retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        }
    }
}

function rejectAfterTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_resolve, reject) => {
        setTimeout(() => {
            reject(new Error(message));
        }, ms);
    });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                resolve();
            },
            { once: true },
        );
    });
}

/** Timeout error message prefix used to distinguish timeouts from other failures. */
const TIMEOUT_PREFIX = "Activity '";
const TIMEOUT_SUFFIX = "' timed out after ";

/** Returns true if the error was caused by an activity timeout. */
function isTimeoutError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return err.message.startsWith(TIMEOUT_PREFIX) && err.message.includes(TIMEOUT_SUFFIX);
}

async function processAssignment(
    assignment: JobAssignment,
    client: WorkerServiceClient,
    registry: ActivityRegistry,
    activityTimeoutMs: number,
    metrics?: WorkerMetrics,
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
            stepId: assignment.stepId || '',
            logsJson: '',
        });
        return;
    }

    const activityLogger = createActivityLogger();
    const jobStartTime = Date.now();

    const startTime = Date.now();
    try {
        const params = assignment.paramsJson ? (JSON.parse(assignment.paramsJson) as unknown) : {};
        const payload = assignment.payloadJson ? (JSON.parse(assignment.payloadJson) as unknown) : null;
        const context = assignment.contextJson ? (JSON.parse(assignment.contextJson) as unknown) : {};
        const result = await Promise.race([
            activity(params, payload, context, activityLogger),
            rejectAfterTimeout(
                activityTimeoutMs,
                `Activity '${assignment.activityType}' timed out after ${String(activityTimeoutMs)}ms`,
            ),
        ]);
        const durationSec = (Date.now() - startTime) / 1000;
        metrics?.activityDuration.observe({ type: assignment.activityType }, durationSec);
        metrics?.activitiesTotal.inc({ type: assignment.activityType, status: 'success' });
        await client.reportJobResult({
            jobId: assignment.jobId,
            agentId: assignment.agentId,
            success: true,
            resultJson: JSON.stringify(result),
            error: '',
            stepId: assignment.stepId || '',
            logsJson: JSON.stringify(activityLogger.entries()),
        });
        const jobDurationSec = (Date.now() - jobStartTime) / 1000;
        metrics?.jobDuration.observe({ agent_id: assignment.agentId }, jobDurationSec);
        metrics?.jobsTotal.inc({ agent_id: assignment.agentId, status: 'success' });
    } catch (err: unknown) {
        const durationSec = (Date.now() - startTime) / 1000;
        metrics?.activityDuration.observe({ type: assignment.activityType }, durationSec);
        const status = isTimeoutError(err) ? 'timeout' : 'failure';
        metrics?.activitiesTotal.inc({ type: assignment.activityType, status });
        const rawMessage =
            err instanceof ZodError ? formatZodError(err) : err instanceof Error ? err.message : String(err);
        const stepName = assignment.stepLabel || assignment.stepId || '';
        const stepLabel = stepName ? ` (step '${stepName}')` : '';
        const errorMessage = `Activity '${assignment.activityType}'${stepLabel} failed: ${rawMessage}`;
        await client.reportJobResult({
            jobId: assignment.jobId,
            agentId: assignment.agentId,
            success: false,
            resultJson: '',
            error: errorMessage,
            stepId: assignment.stepId || '',
            logsJson: JSON.stringify(activityLogger.entries()),
        });
        const jobDurationSec = (Date.now() - jobStartTime) / 1000;
        metrics?.jobDuration.observe({ agent_id: assignment.agentId }, jobDurationSec);
        metrics?.jobsTotal.inc({ agent_id: assignment.agentId, status: 'failure' });
    }
}

/** Formats a Zod validation error into a human-readable string. */
function formatZodError(err: ZodError): string {
    const issues = err.issues.map((issue) => {
        // Strip internal ValueSource path segments (.value, .ref, .type)
        const cleanPath = issue.path.filter((p) => p !== 'value' && p !== 'ref' && p !== 'type');
        const path = cleanPath.length > 0 ? `'${cleanPath.join('.')}' ` : '';
        return `${path}${issue.message}`;
    });
    // Deduplicate messages that collapse to the same path after cleanup
    const unique = [...new Set(issues)];
    return `Invalid params: ${unique.join('; ')}`;
}
