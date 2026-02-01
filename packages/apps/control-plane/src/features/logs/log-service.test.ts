import { describe, expect, it } from 'vitest';

import { createFakeLogRepository } from './fake-log-repository.js';
import { createLogService } from './log-service.js';

describe('LogService', () => {
    it('appends and retrieves logs for a job', async () => {
        const repo = createFakeLogRepository();
        const service = createLogService(repo);

        await service.appendLogs('job-1', [
            { level: 'info', message: 'step started' },
            { level: 'warn', message: 'slow response', metadata: { ms: 3000 } },
        ]);

        const logs = await service.getLogsForJob('job-1');
        expect(logs).toHaveLength(2);
        expect(logs[0].level).toBe('info');
        expect(logs[0].message).toBe('step started');
        expect(logs[1].level).toBe('warn');
        expect(logs[1].metadata).toEqual({ ms: 3000 });
    });

    it('returns empty array for unknown job', async () => {
        const repo = createFakeLogRepository();
        const service = createLogService(repo);

        const logs = await service.getLogsForJob('nonexistent');
        expect(logs).toEqual([]);
    });

    it('skips insert for empty entries', async () => {
        const repo = createFakeLogRepository();
        const service = createLogService(repo);

        await service.appendLogs('job-1', []);
        expect(repo.logs).toHaveLength(0);
    });

    it('stores step_id when provided', async () => {
        const repo = createFakeLogRepository();
        const service = createLogService(repo);

        await service.appendLogs('job-1', [{ step_id: 'fetch', level: 'info', message: 'fetching data' }]);

        const logs = await service.getLogsForJob('job-1');
        expect(logs[0].step_id).toBe('fetch');
    });
});
