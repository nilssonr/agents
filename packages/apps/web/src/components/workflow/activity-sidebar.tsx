import type { DragEvent } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useActivities } from '@/hooks/use-activities';

/** Sidebar listing available activities that can be dragged onto the canvas. */
export function ActivitySidebar() {
    const { data: activities, isLoading } = useActivities();

    function onDragStart(event: DragEvent, activityType: string, defaultParams?: unknown) {
        event.dataTransfer.setData('application/reactflow', activityType);
        event.dataTransfer.setData('application/reactflow-params', JSON.stringify(defaultParams ?? {}));
        event.dataTransfer.effectAllowed = 'move';
    }

    return (
        <div className="w-56 shrink-0 border-r bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Activities</h3>
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : (
                <div className="space-y-2">
                    {activities?.map((activity) => (
                        <div
                            key={activity.type}
                            className="cursor-grab rounded-md border bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:shadow-md"
                            draggable
                            onDragStart={(e) => onDragStart(e, activity.type ?? '', activity.defaultParams)}
                        >
                            {activity.type}
                            <p className="mt-0.5 text-xs text-gray-400">{activity.description}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
