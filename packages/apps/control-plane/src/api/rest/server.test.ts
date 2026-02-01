import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { createAgentService } from '../../features/agents/agent-service.js';
import { createFakeAgentRepository } from '../../features/agents/fake-agent-repository.js';
import { createFakeJobRepository } from '../../features/jobs/fake-job-repository.js';
import { createFlowService } from '../../features/flows/flow-service.js';
import { createJobService } from '../../features/jobs/job-service.js';
import { createFakeLogRepository } from '../../features/logs/fake-log-repository.js';
import { createLogService } from '../../features/logs/log-service.js';
import { buildRestServer } from './server.js';

describe('buildRestServer', () => {
    let agentService: ReturnType<typeof createAgentService>;
    let jobService: ReturnType<typeof createJobService>;
    let logService: ReturnType<typeof createLogService>;

    beforeEach(() => {
        const agentRepo = createFakeAgentRepository();
        const jobRepo = createFakeJobRepository();
        agentService = createAgentService(agentRepo, jobRepo);
        jobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure, createFlowService());
        logService = createLogService(createFakeLogRepository());
    });

    it('includes CORS headers when corsOrigin is provided', async () => {
        const app: FastifyInstance = await buildRestServer({
            agentService,
            jobService,
            logService,
            corsOrigin: 'http://localhost:5173',
        });

        const res = await app.inject({
            method: 'OPTIONS',
            url: '/agents',
            headers: {
                origin: 'http://localhost:5173',
                'access-control-request-method': 'GET',
            },
        });

        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('does not include CORS headers when corsOrigin is not provided', async () => {
        const app: FastifyInstance = await buildRestServer({
            agentService,
            jobService,
            logService,
        });

        const res = await app.inject({
            method: 'OPTIONS',
            url: '/agents',
            headers: {
                origin: 'http://localhost:5173',
                'access-control-request-method': 'GET',
            },
        });

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
});
