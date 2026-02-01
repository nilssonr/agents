import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createTestWrapper } from '../test-utils';

const jobs = [
    {
        id: 'j1',
        agent_id: 'a1',
        status: 'completed',
        payload: {},
        result: null,
        error: null,
        current_step_id: null,
        context: {},
        step_retries: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    },
];
const logs = [{ id: 'l1', job_id: 'j1', step_id: 'step-1', level: 'info', message: 'hello', metadata: {} }];

vi.mock('@/api-client', () => ({
    apiClient: {
        GET: vi.fn(async (path: string) => {
            if (path === '/agents/{id}/jobs') return { data: jobs };
            if (path === '/jobs/{id}/logs') return { data: logs };
            return { data: undefined };
        }),
    },
}));

const { useAgentJobs, useJobLogs } = await import('./use-jobs');

describe('useAgentJobs', () => {
    it('fetches jobs for an agent', async () => {
        const { result } = renderHook(() => useAgentJobs('a1'), { wrapper: createTestWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toHaveLength(1);
    });
});

describe('useJobLogs', () => {
    it('fetches logs for a job', async () => {
        const { result } = renderHook(() => useJobLogs('j1'), { wrapper: createTestWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toHaveLength(1);
        expect(result.current.data![0]!.message).toBe('hello');
    });
});
