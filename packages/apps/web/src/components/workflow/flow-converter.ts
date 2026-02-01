import type { Node, Edge, Viewport } from '@xyflow/react';

/** A single flow step as stored in the agent's activities array. */
export interface FlowStep {
    id?: string;
    type: string;
    label?: string;
    params?: unknown;
    maxRetries?: number;
    onError?: Record<string, string>;
}

/** Persisted editor layout for restoring node positions and viewport. */
export interface EditorLayout {
    nodes: Array<{ id: string; position: { x: number; y: number } }>;
    viewport?: Viewport;
}

const NODE_SPACING_X = 200;
const NODE_START_X = 50;
const NODE_START_Y = 150;

/** Converts FlowStep[] + optional layout into React Flow nodes and edges. */
export function flowStepsToGraph(steps: FlowStep[], layout?: EditorLayout | null): { nodes: Node[]; edges: Edge[] } {
    const layoutMap = new Map<string, { x: number; y: number }>();
    if (layout?.nodes) {
        for (const n of layout.nodes) {
            layoutMap.set(n.id, n.position);
        }
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Start node
    const startPos = layoutMap.get('start') ?? { x: NODE_START_X, y: NODE_START_Y };
    nodes.push({
        id: 'start',
        type: 'start',
        position: startPos,
        data: { label: 'Start' },
    });

    let prevId = 'start';

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const nodeId = step.id ?? `step-${i}`;
        const pos = layoutMap.get(nodeId) ?? {
            x: NODE_START_X + (i + 1) * NODE_SPACING_X,
            y: NODE_START_Y,
        };

        nodes.push({
            id: nodeId,
            type: 'activity',
            position: pos,
            data: {
                activityType: step.type,
                label: step.label ?? '',
                params: step.params ?? {},
                maxRetries: step.maxRetries,
                onError: step.onError,
            },
        });

        edges.push({
            id: `${prevId}->${nodeId}`,
            source: prevId,
            target: nodeId,
        });

        prevId = nodeId;
    }

    return { nodes, edges };
}

/** Converts React Flow nodes and edges back to FlowStep[]. */
export function graphToFlowSteps(nodes: Node[], edges: Edge[]): FlowStep[] {
    // Build adjacency from edges
    const adj = new Map<string, string>();
    for (const edge of edges) {
        adj.set(edge.source, edge.target);
    }

    // Walk from 'start' to 'end' following edges
    const steps: FlowStep[] = [];
    let currentId = adj.get('start');

    while (currentId) {
        const node = nodes.find((n) => n.id === currentId);
        if (!node) break;

        const data = node.data as {
            activityType: string;
            label?: string;
            params?: unknown;
            maxRetries?: number;
            onError?: Record<string, string>;
        };

        const step: FlowStep = {
            id: node.id,
            type: data.activityType,
        };
        if (data.label) {
            step.label = data.label;
        }
        if (data.params && Object.keys(data.params as object).length > 0) {
            step.params = data.params;
        }
        if (data.maxRetries !== undefined) {
            step.maxRetries = data.maxRetries;
        }
        if (data.onError) {
            step.onError = data.onError;
        }

        steps.push(step);
        currentId = adj.get(currentId);
    }

    return steps;
}

/** Extracts the editor layout (node positions + viewport) for persistence. */
export function getEditorLayout(nodes: Node[], viewport: Viewport): EditorLayout {
    return {
        nodes: nodes.map((n) => ({ id: n.id, position: n.position })),
        viewport,
    };
}
