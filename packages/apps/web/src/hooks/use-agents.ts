import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api-client';

export function useAgents() {
    return useQuery({
        queryKey: ['agents'],
        queryFn: async () => {
            const { data } = await apiClient.GET('/agents');
            return data;
        },
    });
}

export function useAgent(id: string) {
    return useQuery({
        queryKey: ['agents', id],
        queryFn: async () => {
            const { data } = await apiClient.GET('/agents/{id}', { params: { path: { id } } });
            return data;
        },
    });
}

export function useCreateAgent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: { name: string }) => {
            const { data } = await apiClient.POST('/agents', { body });
            return data;
        },
        onSuccess: () => { void qc.invalidateQueries({ queryKey: ['agents'] }); },
    });
}

export function useDeleteAgent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.DELETE('/agents/{id}', { params: { path: { id } } });
        },
        onSuccess: () => { void qc.invalidateQueries({ queryKey: ['agents'] }); },
    });
}

export function useInvokeAgent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ agentId, payload }: { agentId: string; payload: unknown }) => {
            const { data } = await apiClient.POST('/agents/{id}/invoke', {
                params: { path: { id: agentId } },
                body: payload,
            });
            return data;
        },
        onSuccess: () => { void qc.invalidateQueries({ queryKey: ['agents'] }); },
    });
}

export function useRestartAgent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await apiClient.POST('/agents/{id}/restart', { params: { path: { id } } });
            return data;
        },
        onSuccess: () => { void qc.invalidateQueries({ queryKey: ['agents'] }); },
    });
}
