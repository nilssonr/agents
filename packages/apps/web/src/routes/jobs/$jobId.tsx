import { createRoute, useParams } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobLogs } from '@/hooks/use-jobs';
import { rootRoute } from '../__root';

export const jobDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/jobs/$jobId',
    component: JobDetailPage,
});

function JobDetailPage() {
    const { jobId } = useParams({ from: '/jobs/$jobId' });
    const { data: logs, isLoading } = useJobLogs(jobId);

    if (isLoading) {
        return <Skeleton className="h-64 w-full" />;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Job {jobId.slice(0, 8)}</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    {logs && logs.length > 0 ? (
                        <div className="space-y-2" data-testid="log-entries">
                            {logs.map((log, i) => (
                                <div key={i} className="flex items-start gap-2 rounded border p-2 text-sm font-mono">
                                    <Badge variant={log.level === 'error' ? 'destructive' : 'secondary'} className="shrink-0">
                                        {log.level}
                                    </Badge>
                                    <span className="text-muted-foreground">[{log.step_id}]</span>
                                    <span>{log.message}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground" data-testid="no-logs">No logs available</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
