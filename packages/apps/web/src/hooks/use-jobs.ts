import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api-client';

export function useAgentJobs(agentId: string) {
    return useQuery({
        queryKey: ['agents', agentId, 'jobs'],
        queryFn: async () => {
            const { data } = await apiClient.GET('/agents/{id}/jobs', { params: { path: { id: agentId } } });
            return data;
        },
    });
}

export function useJobLogs(jobId: string) {
    return useQuery({
        queryKey: ['jobs', jobId, 'logs'],
        queryFn: async () => {
            const { data } = await apiClient.GET('/jobs/{id}/logs', { params: { path: { id: jobId } } });
            return data;
        },
    });
}
