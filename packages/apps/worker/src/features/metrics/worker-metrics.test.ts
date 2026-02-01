import { describe, expect, it } from 'vitest';
import { Registry } from 'prom-client';

import { createWorkerMetrics } from './worker-metrics.js';

describe('WorkerMetrics', () => {
    it('creates metrics with a fresh registry', () => {
        const reg = new Registry();
        const { metrics, registry } = createWorkerMetrics(reg);

        expect(registry).toBe(reg);
        expect(metrics.activitiesTotal).toBeDefined();
        expect(metrics.activityDuration).toBeDefined();
    });

    it('increments counters and reads values', async () => {
        const { metrics, registry } = createWorkerMetrics();

        metrics.activitiesTotal.inc({ type: 'http-request', status: 'success' });
        metrics.activityDuration.observe({ type: 'http-request' }, 1.5);

        const output = await registry.metrics();
        expect(output).toContain('agents_worker_activities_total');
        expect(output).toContain('agents_worker_activity_duration_seconds');
    });
});
