import { createRoute, useParams } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgent } from '@/hooks/use-agents';
import { useJob, useJobLogs } from '@/hooks/use-jobs';
import { rootRoute } from '../__root';

interface StepInfo {
    id: string;
    type: string;
    label?: string;
}

/** Look up a step's display name from the agent's activities. */
function getStepDisplayName(activities: unknown, stepId: string): string | null {
    if (!Array.isArray(activities)) return null;
    const step = activities.find((a: StepInfo) => a.id === stepId) as StepInfo | undefined;
    if (!step) return null;
    return step.label || `${step.type} (${step.id})`;
}

export const jobDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/jobs/$jobId',
    component: JobDetailPage,
});

function JobDetailPage() {
    const { jobId } = useParams({ from: '/jobs/$jobId' });
    const { data: job, isLoading: jobLoading } = useJob(jobId);
    const { data: agent } = useAgent(job?.agent_id ?? '');
    const { data: logs, isLoading: logsLoading } = useJobLogs(jobId);

    if (jobLoading) {
        return <Skeleton className="h-64 w-full" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">Job {jobId.slice(0, 8)}</h1>
                {job && (
                    <Badge
                        variant={
                            job.status === 'completed'
                                ? 'default'
                                : job.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                        }
                    >
                        {job.status}
                    </Badge>
                )}
            </div>

            {job?.error && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-red-700">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="whitespace-pre-wrap break-words rounded bg-red-50 p-3 font-mono text-sm text-red-800">
                            {job.error}
                        </pre>
                        {job.current_step_id && (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Failed at step:{' '}
                                <code className="font-mono">
                                    {getStepDisplayName(agent?.activities, job.current_step_id) ?? job.current_step_id}
                                </code>
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    {logsLoading ? (
                        <Skeleton className="h-32 w-full" />
                    ) : logs && logs.length > 0 ? (
                        <div className="space-y-2" data-testid="log-entries">
                            {logs.map((log, i) => (
                                <div key={i} className="flex items-start gap-2 rounded border p-2 font-mono text-sm">
                                    <Badge
                                        variant={log.level === 'error' ? 'destructive' : 'secondary'}
                                        className="shrink-0"
                                    >
                                        {log.level}
                                    </Badge>
                                    {log.step_id && (
                                        <span className="text-muted-foreground">
                                            [{getStepDisplayName(agent?.activities, log.step_id) ?? log.step_id}]
                                        </span>
                                    )}
                                    <span>{log.message}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground" data-testid="no-logs">
                            No logs available
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
