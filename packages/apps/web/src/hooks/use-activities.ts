import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api-client';

/** Fetches available activity type definitions from the control-plane. */
export function useActivities() {
    return useQuery({
        queryKey: ['activities'],
        queryFn: async () => {
            const { data } = await apiClient.GET('/activities');
            return data;
        },
    });
}
