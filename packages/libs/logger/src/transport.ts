import { Transform } from 'node:stream';

const LEVEL_LABELS: Record<number, string> = {
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL',
};

function formatTimestamp(epochMs: number): string {
    const date = new Date(epochMs);
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const minutes = String(absOffset % 60).padStart(2, '0');
    const iso = date.toISOString().replace('Z', '');
    return `${iso}${sign}${hours}:${minutes}`;
}

export function createTransportStream(): Transform {
    return new Transform({
        objectMode: true,
        transform(chunk: string, _encoding, callback): void {
            const obj = JSON.parse(chunk) as Record<string, unknown>;
            const time = typeof obj['time'] === 'number' ? obj['time'] : Date.now();
            const level =
                typeof obj['level'] === 'number' ? (LEVEL_LABELS[obj['level']] ?? 'UNKNOWN') : 'UNKNOWN';
            const msg = typeof obj['msg'] === 'string' ? obj['msg'] : '';

            const fields: Record<string, unknown> = {};
            for (const key of Object.keys(obj)) {
                if (key !== 'time' && key !== 'level' && key !== 'msg' && key !== 'pid' && key !== 'hostname') {
                    fields[key] = obj[key];
                }
            }

            const fieldStr = Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : '';
            const timestamp = formatTimestamp(time);

            process.stdout.write(`[${timestamp}] ${level} - ${msg}${fieldStr}\n`);
            callback();
        },
    });
}
