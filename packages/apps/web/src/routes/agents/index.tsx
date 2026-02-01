import { createRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgents, useCreateAgent, useDeleteAgent } from '@/hooks/use-agents';
import { rootRoute } from '../__root';

export const agentsIndexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/agents',
    component: AgentListPage,
});

function AgentListPage() {
    const { data: agents, isLoading } = useAgents();
    const createAgent = useCreateAgent();
    const deleteAgent = useDeleteAgent();
    const [name, setName] = useState('');
    const [open, setOpen] = useState(false);

    function handleCreate() {
        if (!name.trim()) return;
        createAgent.mutate({ name: name.trim() }, { onSuccess: () => { setName(''); setOpen(false); } });
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Agents</h1>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="create-agent-btn">
                            <Plus className="mr-2 h-4 w-4" /> Create Agent
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Agent</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <Input
                                placeholder="Agent name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                data-testid="agent-name-input"
                            />
                            <Button onClick={handleCreate} disabled={createAgent.isPending} data-testid="submit-create-agent">
                                Create
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Failures</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {agents?.map((agent) => (
                        <TableRow key={agent.id} data-testid="agent-row">
                            <TableCell>
                                <a href={`/agents/${agent.id}`} className="font-medium hover:underline">
                                    {agent.name}
                                </a>
                            </TableCell>
                            <TableCell>
                                <Badge variant={agent.status === 'active' ? 'default' : 'destructive'}>
                                    {agent.status}
                                </Badge>
                            </TableCell>
                            <TableCell>{agent.failure_count}</TableCell>
                            <TableCell>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteAgent.mutate(agent.id)}
                                    data-testid="delete-agent-btn"
                                >
                                    Delete
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {agents?.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                                No agents yet
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
