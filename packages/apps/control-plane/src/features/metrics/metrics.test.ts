import { Registry } from 'prom-client';
import { describe, expect, it } from 'vitest';

import { createMetrics } from './metrics.js';

describe('Metrics', () => {
    it('creates metrics with a fresh registry', () => {
        const reg = new Registry();
        const { metrics, registry } = createMetrics(reg);

        expect(registry).toBe(reg);
        expect(metrics.jobsTotal).toBeDefined();
        expect(metrics.jobsDuration).toBeDefined();
        expect(metrics.jobsActive).toBeDefined();
        expect(metrics.schedulerTicks).toBeDefined();
        expect(metrics.grpcAssignments).toBeDefined();
    });

    it('increments counters and reads values', async () => {
        const { metrics, registry } = createMetrics();

        metrics.jobsTotal.inc({ status: 'completed', agent_id: 'a1' });
        metrics.jobsTotal.inc({ status: 'failed', agent_id: 'a1' });
        metrics.schedulerTicks.inc();
        metrics.grpcAssignments.inc();
        metrics.jobsActive.inc();

        const output = await registry.metrics();
        expect(output).toContain('agents_jobs_total');
        expect(output).toContain('agents_scheduler_ticks_total');
        expect(output).toContain('agents_grpc_assignments_total');
        expect(output).toContain('agents_jobs_active');
    });
});
