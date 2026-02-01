import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

interface ActivityNodeData {
    activityType: string;
    label?: string;
    params?: unknown;
    maxRetries?: number;
    [key: string]: unknown;
}

/** Custom React Flow node representing a single activity step. */
export function ActivityNode({ data, selected }: NodeProps) {
    const { activityType, label } = data as unknown as ActivityNodeData;

    return (
        <div
            className={`min-w-[160px] rounded-lg border-2 bg-white px-4 py-3 shadow-sm ${
                selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
            }`}
        >
            <Handle type="target" position={Position.Left} />
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{activityType}</div>
            {label && <div className="mt-1 text-sm font-semibold">{label}</div>}
            <Handle type="source" position={Position.Right} />
        </div>
    );
}
