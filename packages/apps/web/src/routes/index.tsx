import { createRoute } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgents } from '@/hooks/use-agents';
import { useHealth } from '@/hooks/use-health';
import { rootRoute } from './__root';

export const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Dashboard,
});

function Dashboard() {
    const { data: agents, isLoading: agentsLoading } = useAgents();
    const { data: health, isLoading: healthLoading } = useHealth();

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Agents</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {agentsLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <p className="text-2xl font-bold" data-testid="agent-count">
                                {agents?.length ?? 0}
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {healthLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <Badge
                                variant={health?.status === 'ok' ? 'default' : 'destructive'}
                                data-testid="health-status"
                            >
                                {health?.status ?? 'unknown'}
                            </Badge>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
