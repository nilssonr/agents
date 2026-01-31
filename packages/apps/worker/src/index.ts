import { createLogger } from '@agents/logger';

import { createWorkerApp } from './app.js';

const logger = createLogger('worker');

const app = createWorkerApp();
const abortController = new AbortController();

logger.info({ workerId: app.config.workerId, grpcAddress: app.config.grpcAddress }, 'worker starting');

app.run(abortController.signal).catch((err: unknown) => {
    logger.error({ err }, 'worker error');
    process.exit(1);
});

process.on('SIGINT', () => {
    logger.info('worker shutting down');
    abortController.abort();
});
process.on('SIGTERM', () => {
    logger.info('worker shutting down');
    abortController.abort();
});
