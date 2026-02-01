import { createRoute, useParams } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgent, useRestartAgent } from '@/hooks/use-agents';
import { useAgentJobs } from '@/hooks/use-jobs';
import { rootRoute } from '../__root';

export const agentDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/agents/$agentId',
    component: AgentDetailPage,
});

function AgentDetailPage() {
    const { agentId } = useParams({ from: '/agents/$agentId' });
    const { data: agent, isLoading } = useAgent(agentId);
    const { data: jobs, isLoading: jobsLoading } = useAgentJobs(agentId);
    const restartAgent = useRestartAgent();

    if (isLoading) {
        return <Skeleton className="h-64 w-full" />;
    }

    if (!agent) {
        return <p>Agent not found</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold" data-testid="agent-name">
                        {agent.name}
                    </h1>
                    <Badge variant={agent.status === 'active' ? 'default' : 'destructive'} data-testid="agent-status">
                        {agent.status}
                    </Badge>
                </div>
                <div className="flex gap-2">
                    <a href={`/agents/${agentId}/editor`}>
                        <Button variant="outline" data-testid="edit-workflow-btn">
                            Edit Workflow
                        </Button>
                    </a>
                    <Button
                        variant="outline"
                        onClick={() => restartAgent.mutate(agentId)}
                        disabled={agent.status === 'active'}
                        data-testid="restart-btn"
                    >
                        Restart
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                    {jobsLoading ? (
                        <Skeleton className="h-32 w-full" />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Error</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {jobs?.map((job) => (
                                    <TableRow key={job.id} data-testid="job-row">
                                        <TableCell>
                                            <a href={`/jobs/${job.id}`} className="font-mono text-sm hover:underline">
                                                {job.id.slice(0, 8)}
                                            </a>
                                        </TableCell>
                                        <TableCell>
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
                                        </TableCell>
                                        <TableCell>
                                            {job.error && (
                                                <span
                                                    className="line-clamp-1 max-w-xs text-xs text-red-600"
                                                    title={job.error}
                                                >
                                                    {job.error}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                {jobs?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                                            No jobs yet
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
