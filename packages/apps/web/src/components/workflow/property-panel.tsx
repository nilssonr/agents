import type { Node } from '@xyflow/react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useActivities } from '@/hooks/use-activities';

interface ParamDef {
    type: string;
    required: boolean;
}

interface PropertyPanelProps {
    node: Node | null;
    onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
    onDelete: (nodeId: string) => void;
}

/** Side panel for editing a selected activity node's parameters. */
export function PropertyPanel({ node, onUpdate, onDelete }: PropertyPanelProps) {
    const { data: activities } = useActivities();
    const [label, setLabel] = useState('');
    const [paramsText, setParamsText] = useState('{}');
    const [maxRetries, setMaxRetries] = useState('');

    useEffect(() => {
        if (node && node.type === 'activity') {
            const data = node.data as { label?: string; params?: unknown; maxRetries?: number };
            setLabel(data.label ?? '');
            setParamsText(JSON.stringify(data.params ?? {}, null, 2));
            setMaxRetries(data.maxRetries !== undefined ? String(data.maxRetries) : '');
        }
    }, [node]);

    if (!node || node.type !== 'activity') {
        return (
            <div className="w-64 shrink-0 border-l bg-gray-50 p-4">
                <p className="text-sm text-gray-400">Select a node to edit its properties</p>
            </div>
        );
    }

    const data = node.data as { activityType: string };
    const activityDef = activities?.find((a: { type?: string }) => a.type === data.activityType) as
        | { params?: Record<string, ParamDef> }
        | undefined;
    const paramDefs = activityDef?.params;

    function handleApply() {
        if (!node) return;
        try {
            const parsed = JSON.parse(paramsText);
            const retries = maxRetries ? parseInt(maxRetries, 10) : undefined;
            onUpdate(node.id, {
                ...node.data,
                label,
                params: parsed,
                maxRetries: retries,
            });
        } catch {
            // Invalid JSON — ignore
        }
    }

    return (
        <div className="w-64 shrink-0 border-l bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Properties</h3>
            <div className="space-y-3">
                <div>
                    <label className="text-xs font-medium text-gray-500">Type</label>
                    <p className="text-sm font-semibold">{data.activityType}</p>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-500">Label</label>
                    <Input
                        className="mt-1"
                        placeholder="e.g. Get user data"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-500">Params (JSON)</label>
                    {paramDefs && Object.keys(paramDefs).length > 0 && (
                        <div className="mt-1 rounded bg-blue-50 px-2 py-1.5 text-xs text-blue-700">
                            {Object.entries(paramDefs).map(([name, def]) => (
                                <div key={name}>
                                    <span className="font-semibold">{name}</span>
                                    {def.required && <span className="text-red-500">*</span>}
                                    <span className="ml-1 text-blue-500">
                                        {def.type.replace(/^ValueSource<(.+)>$/, '$1')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    <Textarea
                        className="mt-1 font-mono text-xs"
                        rows={6}
                        value={paramsText}
                        onChange={(e) => setParamsText(e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-500">Max Retries</label>
                    <Input
                        type="number"
                        className="mt-1"
                        placeholder="0"
                        value={maxRetries}
                        onChange={(e) => setMaxRetries(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={handleApply}>
                        Apply
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(node.id)}>
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
}
