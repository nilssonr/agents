import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it, beforeEach } from 'vitest';

import { createFakeLogRepository } from '../../features/logs/fake-log-repository.js';
import { createLogService } from '../../features/logs/log-service.js';
import type { LogService } from '../../features/logs/log-service.js';

import { registerJobRoutes } from './jobs.js';

describe('GET /jobs/:id/logs', () => {
    let app: FastifyInstance;
    let logService: LogService;

    beforeEach(async () => {
        const logRepo = createFakeLogRepository();
        logService = createLogService(logRepo);
        app = Fastify();
        registerJobRoutes(app, { logService });
        await app.ready();
    });

    it('returns logs for a job', async () => {
        await logService.appendLogs('job-1', [
            { level: 'info', message: 'started' },
            { level: 'error', message: 'failed', metadata: { code: 500 } },
        ]);

        const response = await app.inject({ method: 'GET', url: '/jobs/job-1/logs' });
        expect(response.statusCode).toBe(200);

        const body: Array<{ message: string; level: string }> = response.json();
        expect(body).toHaveLength(2);
        expect(body[0].message).toBe('started');
        expect(body[1].level).toBe('error');
    });

    it('returns empty array for job with no logs', async () => {
        const response = await app.inject({ method: 'GET', url: '/jobs/unknown/logs' });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });
});
