import { Registry, Counter, Histogram, Gauge } from 'prom-client';

/** Application-level metrics for the control-plane. */
export interface Metrics {
    jobsTotal: Counter<'status' | 'agent_id'>;
    jobsDuration: Histogram<'status' | 'agent_id'>;
    jobsActive: Gauge;
    schedulerTicks: Counter;
    grpcAssignments: Counter;
}

/** Creates a {@link Metrics} instance backed by the given (or a new) Prometheus registry. */
export function createMetrics(registry?: Registry): { metrics: Metrics; registry: Registry } {
    const reg = registry ?? new Registry();
    return {
        registry: reg,
        metrics: {
            jobsTotal: new Counter({
                name: 'agents_jobs_total',
                help: 'Total jobs by status and agent',
                labelNames: ['status', 'agent_id'] as const,
                registers: [reg],
            }),
            jobsDuration: new Histogram({
                name: 'agents_jobs_duration_seconds',
                help: 'Job duration in seconds',
                labelNames: ['status', 'agent_id'] as const,
                buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
                registers: [reg],
            }),
            jobsActive: new Gauge({
                name: 'agents_jobs_active',
                help: 'Currently active (running) jobs',
                registers: [reg],
            }),
            schedulerTicks: new Counter({
                name: 'agents_scheduler_ticks_total',
                help: 'Total cron scheduler ticks',
                registers: [reg],
            }),
            grpcAssignments: new Counter({
                name: 'agents_grpc_assignments_total',
                help: 'Total gRPC job assignments streamed to workers',
                registers: [reg],
            }),
        },
    };
}
