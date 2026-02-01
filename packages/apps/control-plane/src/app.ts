import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import pg from 'pg';

import { loadConfig } from '@agents/config';
import { createMetricsServer } from '@agents/metrics';
import { createMigrationRunner } from '@agents/migrations';

import { createPgAgentRepository } from './adapters/postgres/pg-agent-repository.js';
import { createPgJobRepository } from './adapters/postgres/pg-job-repository.js';
import { createPgLogRepository } from './adapters/postgres/pg-log-repository.js';
import { createPgTriggerRepository } from './adapters/postgres/pg-trigger-repository.js';
import { createAgentService } from './features/agents/agent-service.js';
import { createFlowService } from './features/flows/flow-service.js';
import { createJobReaper } from './features/jobs/job-reaper.js';
import { createJobService } from './features/jobs/job-service.js';
import { createLogService } from './features/logs/log-service.js';
import { createMetrics } from './features/metrics/metrics.js';
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
export async function createApp(): Promise<App> {
    // Config
    const config = loadConfig({
        httpPort: { env: 'HTTP_PORT' },
        grpcPort: { env: 'GRPC_PORT' },
        databaseUrl: { env: 'DATABASE_URL' },
        dbPoolMin: { env: 'DB_POOL_MIN', default: '2' },
        dbPoolMax: { env: 'DB_POOL_MAX', default: '10' },
        dbConnectionTimeoutMs: { env: 'DB_CONNECTION_TIMEOUT_MS', default: '5000' },
        dbIdleTimeoutMs: { env: 'DB_IDLE_TIMEOUT_MS', default: '30000' },
        cronIntervalMs: { env: 'CRON_INTERVAL_MS', default: '60000' },
        grpcPollIntervalMs: { env: 'GRPC_POLL_INTERVAL_MS', default: '1000' },
        jobReaperTtlMs: { env: 'JOB_REAPER_TTL_MS', default: '300000' },
        jobReaperIntervalMs: { env: 'JOB_REAPER_INTERVAL_MS', default: '60000' },
        metricsPort: { env: 'METRICS_PORT', default: '9090' },
        maxContextSizeBytes: { env: 'MAX_CONTEXT_SIZE_BYTES', default: '1048576' },
        corsOrigin: { env: 'CORS_ORIGIN', required: false },
    });

    // Infrastructure
    const pool = new pg.Pool({
        connectionString: config.databaseUrl,
        min: Number(config.dbPoolMin),
        max: Number(config.dbPoolMax),
        connectionTimeoutMillis: Number(config.dbConnectionTimeoutMs),
        idleTimeoutMillis: Number(config.dbIdleTimeoutMs),
    });
    const migrationsPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'sql', 'migrations');
    const migrationRunner = createMigrationRunner(pool, { migrationsPath });
    const agentRepo = createPgAgentRepository(pool);
    const jobRepo = createPgJobRepository(pool);
    const logRepo = createPgLogRepository(pool);
    const triggerRepo = createPgTriggerRepository(pool);

    // Metrics
    const { metrics, registry: metricsRegistry } = createMetrics();
    const metricsServer = createMetricsServer(metricsRegistry, Number(config.metricsPort));

    // Features
    const flowService = createFlowService();
    const agentService = createAgentService(agentRepo, jobRepo);
    const jobService = createJobService(jobRepo, agentRepo, agentService.handleJobFailure, flowService, metrics, Number(config.maxContextSizeBytes));
    const logService = createLogService(logRepo);
    const cronScheduler = createCronScheduler(triggerRepo, agentService, Number(config.cronIntervalMs), metrics);
    const jobReaper = createJobReaper(
        jobRepo,
        async (_jobId, agentId) => {
            await agentService.handleJobFailure(agentId);
        },
        { ttlMs: Number(config.jobReaperTtlMs), intervalMs: Number(config.jobReaperIntervalMs) },
    );

    // API
    const rest = await buildRestServer({
        agentService,
        jobService,
        logService,
        checkDb: async () => { await pool.query('SELECT 1'); },
        corsOrigin: config.corsOrigin,
    });
    const workerImpl = createWorkerServiceImpl(agentService, jobService, jobRepo, flowService, logService, {
        pollIntervalMs: Number(config.grpcPollIntervalMs),
        metrics,
    });
    const grpcServer = startGrpcServer(Number(config.grpcPort), workerImpl);

    return {
        async start(): Promise<string> {
            await migrationRunner.up();
            await metricsServer.start();
            cronScheduler.start();
            jobReaper.start();
            return rest.listen({ port: Number(config.httpPort), host: '0.0.0.0' });
        },
        async shutdown(): Promise<void> {
            cronScheduler.stop();
            jobReaper.stop();
            await grpcServer.shutdown();
            await rest.close();
            await metricsServer.stop();
            await pool.end();
        },
    };
}
