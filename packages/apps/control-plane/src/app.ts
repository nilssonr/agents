import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import type { Server } from 'nice-grpc';

import { loadConfig } from '@agents/config';

import { startGrpcServer } from './api/grpc/server.js';
import { createWorkerServiceImpl } from './api/grpc/worker-service-impl.js';
import { buildRestServer } from './api/rest/server.js';
import { createPgAgentRepository } from './adapters/postgres/pg-agent-repository.js';
import { createPgJobRepository } from './adapters/postgres/pg-job-repository.js';
import { createPgTriggerRepository } from './adapters/postgres/pg-trigger-repository.js';
import { createCronScheduler } from './features/scheduler/cron-scheduler.js';
import type { CronScheduler } from './features/scheduler/cron-scheduler.js';
import { createAgentService } from './features/agents/agent-service.js';
import { createJobService } from './features/jobs/job-service.js';

export interface App {
    rest: FastifyInstance;
    grpcServer: Server;
    cronScheduler: CronScheduler;
    shutdown(): Promise<void>;
}

export function createApp(): App {
    const config = loadConfig({
        httpPort: { env: 'HTTP_PORT', default: '3000' },
        grpcPort: { env: 'GRPC_PORT', default: '50051' },
        databaseUrl: { env: 'DATABASE_URL', default: 'postgres://agents:agents@localhost:5444/agents' },
        cronIntervalMs: { env: 'CRON_INTERVAL_MS', default: '60000' },
        grpcPollIntervalMs: { env: 'GRPC_POLL_INTERVAL_MS', default: '1000' },
    });

    const pool = new pg.Pool({ connectionString: config.databaseUrl });

    const agentRepo = createPgAgentRepository(pool);
    const jobRepo = createPgJobRepository(pool);
    const triggerRepo = createPgTriggerRepository(pool);

    const agentService = createAgentService(agentRepo, jobRepo);
    const jobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure);

    const rest = buildRestServer({ agentService, jobService });

    const workerImpl = createWorkerServiceImpl(agentService, jobService, {
        pollIntervalMs: Number(config.grpcPollIntervalMs),
    });
    const grpcServer = startGrpcServer(Number(config.grpcPort), workerImpl);

    const cronScheduler = createCronScheduler(triggerRepo, agentService, Number(config.cronIntervalMs));

    return {
        rest,
        grpcServer,
        cronScheduler,
        async shutdown(): Promise<void> {
            cronScheduler.stop();
            await grpcServer.shutdown();
            await rest.close();
            await pool.end();
        },
    };
}
