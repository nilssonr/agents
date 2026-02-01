import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api-client';

export function useHealth() {
    return useQuery({
        queryKey: ['health'],
        queryFn: async () => {
            const { data } = await apiClient.GET('/health');
            return data;
        },
        refetchInterval: 30_000,
    });
}
