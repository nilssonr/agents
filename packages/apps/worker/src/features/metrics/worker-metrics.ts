import { Registry, Counter, Histogram, Gauge } from 'prom-client';

/** Worker-side metrics for activity execution and job processing. */
export interface WorkerMetrics {
    activitiesTotal: Counter<'type' | 'status'>;
    activityDuration: Histogram<'type'>;
    jobsTotal: Counter<'agent_id' | 'status'>;
    jobDuration: Histogram<'agent_id'>;
    reconnectsTotal: Counter;
    connected: Gauge;
}

/** Creates a {@link WorkerMetrics} instance backed by the given (or a new) Prometheus registry. */
export function createWorkerMetrics(registry?: Registry): { metrics: WorkerMetrics; registry: Registry } {
    const reg = registry ?? new Registry();
    const buckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];
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
                buckets,
                registers: [reg],
            }),
            jobsTotal: new Counter({
                name: 'agents_worker_jobs_total',
                help: 'Total jobs processed per agent by status',
                labelNames: ['agent_id', 'status'] as const,
                registers: [reg],
            }),
            jobDuration: new Histogram({
                name: 'agents_worker_job_duration_seconds',
                help: 'Full job processing time including gRPC reporting',
                labelNames: ['agent_id'] as const,
                buckets,
                registers: [reg],
            }),
            reconnectsTotal: new Counter({
                name: 'agents_worker_reconnects_total',
                help: 'Number of gRPC reconnection attempts',
                registers: [reg],
            }),
            connected: new Gauge({
                name: 'agents_worker_connected',
                help: '1 when connected to control-plane, 0 when disconnected',
                registers: [reg],
            }),
        },
    };
}
