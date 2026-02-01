import { Registry, Counter, Histogram } from 'prom-client';

/** Worker-side metrics for activity execution. */
export interface WorkerMetrics {
    activitiesTotal: Counter<'type' | 'status'>;
    activityDuration: Histogram<'type'>;
}

/** Creates a {@link WorkerMetrics} instance backed by the given (or a new) Prometheus registry. */
export function createWorkerMetrics(registry?: Registry): { metrics: WorkerMetrics; registry: Registry } {
    const reg = registry ?? new Registry();
    return {
        registry: reg,
        metrics: {
            activitiesTotal: new Counter({
                name: 'agents_worker_activities_total',
                help: 'Total worker activities by type and status',
                labelNames: ['type', 'status'] as const,
                registers: [reg],
            }),
            activityDuration: new Histogram({
                name: 'agents_worker_activity_duration_seconds',
                help: 'Activity execution duration in seconds',
                labelNames: ['type'] as const,
                registers: [reg],
            }),
        },
    };
}
