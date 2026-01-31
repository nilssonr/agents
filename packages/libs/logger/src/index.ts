import { fileURLToPath } from 'node:url';

import pino from 'pino';

export function createLogger(name: string, level?: string): pino.Logger {
    return pino({
        name,
        level: level ?? 'info',
        transport: {
            target: fileURLToPath(new URL('./transport.js', import.meta.url)),
        },
    });
}
