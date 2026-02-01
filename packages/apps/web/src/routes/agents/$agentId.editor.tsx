import { ReactFlowProvider } from '@xyflow/react';
import { createRoute, useParams } from '@tanstack/react-router';

import type { EditorLayout, FlowStep } from '@/components/workflow/flow-converter';
import { WorkflowEditor } from '@/components/workflow/workflow-editor';
import { Skeleton } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { useAgent, useInvokeAgent, useUpdateAgent } from '@/hooks/use-agents';
import { rootRoute } from '../__root';

export const agentEditorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/agents/$agentId/editor',
    component: AgentEditorPage,
});

function AgentEditorPage() {
    const { agentId } = useParams({ from: '/agents/$agentId/editor' });
    const { data: agent, isLoading } = useAgent(agentId);
    const updateAgent = useUpdateAgent();
    const invokeAgent = useInvokeAgent();

    if (isLoading) {
        return <Skeleton className="h-full w-full" />;
    }

    if (!agent) {
        return <p>Agent not found</p>;
    }

    const steps = (agent.activities as FlowStep[]) ?? [];
    const editorLayout = agent.editor_layout as EditorLayout | null;

    async function handleInvoke(payload: unknown) {
        try {
            await invokeAgent.mutateAsync({ agentId, payload });
            showToast('Agent invoked', 'success');
        } catch {
            showToast('Failed to invoke agent', 'error');
        }
    }

    async function handleSave(newSteps: FlowStep[], layout: EditorLayout) {
        try {
            await updateAgent.mutateAsync({
                id: agentId,
                body: { activities: newSteps, editor_layout: layout },
            });
            showToast('Workflow saved', 'success');
        } catch {
            showToast('Failed to save workflow', 'error');
        }
    }

    return (
        <div className="-m-6 h-[calc(100vh)]">
            <ReactFlowProvider>
                <WorkflowEditor
                    steps={steps}
                    editorLayout={editorLayout}
                    onSave={handleSave}
                    saving={updateAgent.isPending}
                    onInvoke={handleInvoke}
                    invoking={invokeAgent.isPending}
                />
            </ReactFlowProvider>
        </div>
    );
}
