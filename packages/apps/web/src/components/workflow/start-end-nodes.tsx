import { Handle, Position } from '@xyflow/react';

/** Visual-only Start pseudo-node. */
export function StartNode() {
    return (
        <div className="flex h-10 w-24 items-center justify-center rounded-full border-2 border-green-500 bg-green-50 text-sm font-semibold text-green-700">
            Start
            <Handle type="source" position={Position.Right} />
        </div>
    );
}
