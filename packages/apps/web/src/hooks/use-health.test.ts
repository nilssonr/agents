import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createTestWrapper } from '../test-utils';

vi.mock('@/api-client', () => ({
    apiClient: {
        GET: vi.fn(async (path: string) => {
            if (path === '/health') return { data: { status: 'ok' } };
            return { data: undefined };
        }),
    },
}));

const { useHealth } = await import('./use-health');

describe('useHealth', () => {
    it('fetches health status', async () => {
        const { result } = renderHook(() => useHealth(), { wrapper: createTestWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ status: 'ok' });
    });
});
