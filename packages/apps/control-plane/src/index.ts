import { createLogger } from '@agents/logger';

import { createApp } from './app.js';

const logger = createLogger('control-plane');
const app = await createApp();

app.start()
    .then((address) => {
        logger.info({ address }, 'control-plane started');
    })
    .catch((err: unknown) => {
        logger.error({ err }, 'failed to start');
        process.exit(1);
    });

process.on('SIGINT', () => {
    logger.info('shutting down');
    void app.shutdown().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
    logger.info('shutting down');
    void app.shutdown().then(() => process.exit(0));
});
