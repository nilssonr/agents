import { createLogger } from '@agents/logger';

import { createApp } from './app.js';

const logger = createLogger('worker');
const app = createApp();

logger.info('worker starting');

app.start().catch((err: unknown) => {
    logger.error({ err }, 'worker error');
    process.exit(1);
});

process.on('SIGINT', () => {
    logger.info('worker shutting down');
    void app.shutdown().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
    logger.info('worker shutting down');
    void app.shutdown().then(() => process.exit(0));
});
