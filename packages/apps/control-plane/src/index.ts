import pg from 'pg';

import { loadConfig } from '@agents/config';
import { createLogger } from '@agents/logger';

import { buildApp } from './app.js';
import { startGrpcServer } from './api/grpc/server.js';
import { createWorkerServiceImpl } from './api/grpc/worker-service-impl.js';
import { createPgAgentRepository } from './adapters/postgres/pg-agent-repository.js';
import { createPgJobRepository } from './adapters/postgres/pg-job-repository.js';
import { createPgTriggerRepository } from './adapters/postgres/pg-trigger-repository.js';
import { createCronScheduler } from './features/scheduler/cron-scheduler.js';
import { createAgentService } from './features/agents/agent-service.js';
import { createJobService } from './features/jobs/job-service.js';

const logger = createLogger('control-plane');

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

const app = buildApp({ agentService, jobService });

const workerImpl = createWorkerServiceImpl(agentService, jobService, {
    pollIntervalMs: Number(config.grpcPollIntervalMs),
});
const grpcServer = startGrpcServer(Number(config.grpcPort), workerImpl);

const cronScheduler = createCronScheduler(triggerRepo, agentService, Number(config.cronIntervalMs));
cronScheduler.start();

const httpPort = Number(config.httpPort);
app.listen({ port: httpPort, host: '0.0.0.0' })
    .then((address) => {
        logger.info({ address, grpcPort: config.grpcPort }, 'control-plane started');
    })
    .catch((err: unknown) => {
        logger.error({ err }, 'failed to start');
        process.exit(1);
    });

async function shutdown(): Promise<void> {
    logger.info('shutting down');
    cronScheduler.stop();
    await grpcServer.shutdown();
    await app.close();
    await pool.end();
    process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
