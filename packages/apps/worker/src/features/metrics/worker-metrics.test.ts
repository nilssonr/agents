import { Registry } from 'prom-client';
import { describe, expect, it } from 'vitest';

import { createWorkerMetrics } from './worker-metrics.js';

describe('WorkerMetrics', () => {
    it('creates metrics with a fresh registry', () => {
        const reg = new Registry();
        const { metrics, registry } = createWorkerMetrics(reg);

        expect(registry).toBe(reg);
        expect(metrics.activitiesTotal).toBeDefined();
        expect(metrics.activityDuration).toBeDefined();
        expect(metrics.jobsTotal).toBeDefined();
        expect(metrics.jobDuration).toBeDefined();
        expect(metrics.reconnectsTotal).toBeDefined();
        expect(metrics.connected).toBeDefined();
    });

    it('increments counters and reads values', async () => {
        const { metrics, registry } = createWorkerMetrics();

        metrics.activitiesTotal.inc({ type: 'http-request', status: 'success' });
        metrics.activityDuration.observe({ type: 'http-request' }, 1.5);
        metrics.jobsTotal.inc({ agent_id: 'agent-1', status: 'success' });
        metrics.jobDuration.observe({ agent_id: 'agent-1' }, 2.0);
        metrics.reconnectsTotal.inc();
        metrics.connected.set(1);

        const output = await registry.metrics();
        expect(output).toContain('agents_worker_activities_total');
        expect(output).toContain('agents_worker_activity_duration_seconds');
        expect(output).toContain('agents_worker_jobs_total');
        expect(output).toContain('agents_worker_job_duration_seconds');
        expect(output).toContain('agents_worker_reconnects_total');
        expect(output).toContain('agents_worker_connected');
    });

    it('uses explicit histogram buckets for percentile resolution', async () => {
        const { metrics, registry } = createWorkerMetrics();

        metrics.activityDuration.observe({ type: 'test' }, 0.05);

        const output = await registry.metrics();
        expect(output).toContain('le="0.01"');
        expect(output).toContain('le="0.05"');
        expect(output).toContain('le="30"');
    });
});
