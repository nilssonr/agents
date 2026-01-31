import pino from 'pino';

import { createTransportStream } from './transport.js';

export function createLogger(name: string, level?: string): pino.Logger {
    return pino(
        {
            name,
            level: level ?? 'info',
        },
        createTransportStream(),
    );
}
