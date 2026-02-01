import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createTestWrapper } from '../test-utils';

const agent = { id: '1', name: 'test-agent', status: 'active', activities: [], failure_threshold: 3, failure_count: 0, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' };

vi.mock('@/api-client', () => ({
    apiClient: {
        GET: vi.fn(async (path: string) => {
            if (path === '/agents') return { data: [agent] };
            if (path === '/agents/{id}') return { data: agent };
            return { data: undefined };
        }),
        POST: vi.fn(async () => ({ data: agent })),
        DELETE: vi.fn(async () => ({ data: undefined })),
    },
}));

const { useAgents, useAgent } = await import('./use-agents');

describe('useAgents', () => {
    it('fetches the agent list', async () => {
        const { result } = renderHook(() => useAgents(), { wrapper: createTestWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toHaveLength(1);
        expect(result.current.data![0]!.name).toBe('test-agent');
    });
});

describe('useAgent', () => {
    it('fetches a single agent', async () => {
        const { result } = renderHook(() => useAgent('1'), { wrapper: createTestWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data!.name).toBe('test-agent');
    });
});
