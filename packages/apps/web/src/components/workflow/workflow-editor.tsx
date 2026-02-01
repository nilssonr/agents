import {
    ReactFlow,
    Background,
    Controls,
    addEdge,
    useNodesState,
    useEdgesState,
    useReactFlow,
    type Connection,
    type NodeTypes,
    type NodeChange,
    type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useRef, useMemo, useState, type DragEvent } from 'react';

import { ActivityNode } from './activity-node';
import { ActivitySidebar } from './activity-sidebar';
import type { EditorLayout, FlowStep } from './flow-converter';
import { flowStepsToGraph, graphToFlowSteps, getEditorLayout } from './flow-converter';
import { InvokePanel } from './invoke-panel';
import { PropertyPanel } from './property-panel';
import { StartNode } from './start-end-nodes';

interface WorkflowEditorProps {
    steps: FlowStep[];
    editorLayout?: EditorLayout | null;
    onSave: (steps: FlowStep[], layout: EditorLayout) => Promise<void>;
    saving?: boolean;
    onInvoke?: (payload: unknown) => void;
    invoking?: boolean;
}

let nodeIdCounter = 0;
function getNextNodeId(activityType: string) {
    return `${activityType}-${nodeIdCounter++}`;
}

/** Main React Flow canvas wrapper for the workflow editor. */
export function WorkflowEditor({ steps, editorLayout, onSave, saving, onInvoke, invoking }: WorkflowEditorProps) {
    const initial = useMemo(() => flowStepsToGraph(steps, editorLayout), []);
    const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
    const { getViewport, screenToFlowPosition } = useReactFlow();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [dirty, setDirty] = useState(false);
    const [showInvokePanel, setShowInvokePanel] = useState(false);

    const markDirty = useCallback(() => setDirty(true), []);

    const nodeTypes: NodeTypes = useMemo(
        () => ({
            activity: ActivityNode,
            start: StartNode,
        }),
        [],
    );

    const handleNodesChange = useCallback(
        (changes: NodeChange[]) => {
            onNodesChange(changes);
            // Position-only changes (dragging) shouldn't mark dirty
            const structural = changes.some(
                (c) => c.type !== 'position' && c.type !== 'select' && c.type !== 'dimensions',
            );
            if (structural) markDirty();
        },
        [onNodesChange, markDirty],
    );

    const handleEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            onEdgesChange(changes);
            const structural = changes.some((c) => c.type !== 'select');
            if (structural) markDirty();
        },
        [onEdgesChange, markDirty],
    );

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((eds) => addEdge(connection, eds));
            markDirty();
        },
        [setEdges, markDirty],
    );

    const onDragOver = useCallback((event: DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: DragEvent) => {
            event.preventDefault();
            const activityType = event.dataTransfer.getData('application/reactflow');
            if (!activityType) return;

            const defaultParamsRaw = event.dataTransfer.getData('application/reactflow-params');
            let defaultParams = {};
            try {
                defaultParams = defaultParamsRaw ? (JSON.parse(defaultParamsRaw) as Record<string, unknown>) : {};
            } catch {
                // ignore
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: getNextNodeId(activityType),
                type: 'activity' as const,
                position,
                data: { activityType, params: defaultParams },
            };

            setNodes((nds) => [...nds, newNode]);
            markDirty();
        },
        [screenToFlowPosition, setNodes, markDirty],
    );

    const selectedNode = nodes.find((n) => n.selected) ?? null;

    const handleNodeUpdate = useCallback(
        (nodeId: string, data: Record<string, unknown>) => {
            setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data } : n)));
            markDirty();
        },
        [setNodes, markDirty],
    );

    const handleNodeDelete = useCallback(
        (nodeId: string) => {
            setNodes((nds) => nds.filter((n) => n.id !== nodeId));
            setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
            markDirty();
        },
        [setNodes, setEdges, markDirty],
    );

    async function handleSave() {
        const flowSteps = graphToFlowSteps(nodes, edges);
        const layout = getEditorLayout(nodes, getViewport());
        await onSave(flowSteps, layout);
        setDirty(false);
    }

    return (
        <div className="flex h-full">
            <ActivitySidebar />
            <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between border-b px-4 py-2">
                    <h2 className="text-sm font-semibold">Workflow Editor</h2>
                    <div className="flex gap-2">
                        {onInvoke && (
                            <button
                                onClick={() => setShowInvokePanel((v) => !v)}
                                className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Invoke
                            </button>
                        )}
                        <button
                            onClick={() => void handleSave()}
                            disabled={saving || !dirty}
                            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
                <div ref={wrapperRef} className="flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={handleNodesChange}
                        onEdgesChange={handleEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
                        deleteKeyCode="Backspace"
                    >
                        <Background />
                        <Controls />
                    </ReactFlow>
                </div>
            </div>
            {showInvokePanel && onInvoke ? (
                <InvokePanel onInvoke={onInvoke} onClose={() => setShowInvokePanel(false)} invoking={invoking} />
            ) : (
                <PropertyPanel node={selectedNode} onUpdate={handleNodeUpdate} onDelete={handleNodeDelete} />
            )}
        </div>
    );
}
