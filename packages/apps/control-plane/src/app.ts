import pg from 'pg';

import { loadConfig } from '@agents/config';

import { createPgAgentRepository } from './adapters/postgres/pg-agent-repository.js';
import { createPgJobRepository } from './adapters/postgres/pg-job-repository.js';
import { createPgTriggerRepository } from './adapters/postgres/pg-trigger-repository.js';
import { createAgentService } from './features/agents/agent-service.js';
import { createJobService } from './features/jobs/job-service.js';
import { createCronScheduler } from './features/scheduler/cron-scheduler.js';
import { startGrpcServer } from './api/grpc/server.js';
import { createWorkerServiceImpl } from './api/grpc/worker-service-impl.js';
import { buildRestServer } from './api/rest/server.js';

/** The control-plane application handle with lifecycle methods. */
export interface App {
    start(): Promise<string>;
    shutdown(): Promise<void>;
}

/**
 * Wires together all control-plane dependencies — postgres repositories,
 * domain services, cron scheduler, REST API, and gRPC server — and returns
 * an {@link App} handle to start and shut everything down.
 */
export function createApp(): App {
    // Config
    const config = loadConfig({
        httpPort: { env: 'HTTP_PORT' },
        grpcPort: { env: 'GRPC_PORT' },
        databaseUrl: { env: 'DATABASE_URL' },
        cronIntervalMs: { env: 'CRON_INTERVAL_MS', default: '60000' },
        grpcPollIntervalMs: { env: 'GRPC_POLL_INTERVAL_MS', default: '1000' },
    });

    // Infrastructure
    const pool = new pg.Pool({ connectionString: config.databaseUrl });
    const agentRepo = createPgAgentRepository(pool);
    const jobRepo = createPgJobRepository(pool);
    const triggerRepo = createPgTriggerRepository(pool);

    // Features
    const agentService = createAgentService(agentRepo, jobRepo);
    const jobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure);
    const cronScheduler = createCronScheduler(triggerRepo, agentService, Number(config.cronIntervalMs));

    // API
    const rest = buildRestServer({ agentService, jobService });
    const workerImpl = createWorkerServiceImpl(agentService, jobService, {
        pollIntervalMs: Number(config.grpcPollIntervalMs),
    });
    const grpcServer = startGrpcServer(Number(config.grpcPort), workerImpl);

    return {
        async start(): Promise<string> {
            cronScheduler.start();
            return rest.listen({ port: Number(config.httpPort), host: '0.0.0.0' });
        },
        async shutdown(): Promise<void> {
            cronScheduler.stop();
            await grpcServer.shutdown();
            await rest.close();
            await pool.end();
        },
    };
}
