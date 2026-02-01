import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, Outlet } from '@tanstack/react-router';

import { AppLayout } from '@/components/layout/app-layout';

const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 5_000 } },
});

export const rootRoute = createRootRoute({
    component: function RootLayout() {
        return (
            <QueryClientProvider client={queryClient}>
                <AppLayout>
                    <Outlet />
                </AppLayout>
            </QueryClientProvider>
        );
    },
});
