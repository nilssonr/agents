import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import pg from 'pg';

import { loadConfig } from '@agents/config';
import { createMigrationRunner } from '@agents/migrations';

import { createPgAgentRepository } from './adapters/postgres/pg-agent-repository.js';
import { createPgJobRepository } from './adapters/postgres/pg-job-repository.js';
import { createPgLogRepository } from './adapters/postgres/pg-log-repository.js';
import { createPgTriggerRepository } from './adapters/postgres/pg-trigger-repository.js';
import { createAgentService } from './features/agents/agent-service.js';
import { createFlowService } from './features/flows/flow-service.js';
import { createJobService } from './features/jobs/job-service.js';
import { createLogService } from './features/logs/log-service.js';
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
    const migrationsPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'sql', 'migrations');
    const migrationRunner = createMigrationRunner(pool, { migrationsPath });
    const agentRepo = createPgAgentRepository(pool);
    const jobRepo = createPgJobRepository(pool);
    const logRepo = createPgLogRepository(pool);
    const triggerRepo = createPgTriggerRepository(pool);

    // Features
    const flowService = createFlowService();
    const agentService = createAgentService(agentRepo, jobRepo);
    const jobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure, flowService);
    const logService = createLogService(logRepo);
    const cronScheduler = createCronScheduler(triggerRepo, agentService, Number(config.cronIntervalMs));

    // API
    const rest = buildRestServer({ agentService, jobService, logService });
    const workerImpl = createWorkerServiceImpl(agentService, jobService, jobRepo, flowService, logService, {
        pollIntervalMs: Number(config.grpcPollIntervalMs),
    });
    const grpcServer = startGrpcServer(Number(config.grpcPort), workerImpl);

    return {
        async start(): Promise<string> {
            await migrationRunner.up();
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
