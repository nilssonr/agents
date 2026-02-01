import { useRouterState } from '@tanstack/react-router';
import { Bot, LayoutDashboard } from 'lucide-react';

import { cn } from '@/lib/utils';

const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/agents', label: 'Agents', icon: Bot },
];

export function Sidebar() {
    const router = useRouterState();
    const pathname = router.location.pathname;

    return (
        <aside className="flex h-full w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
            <div className="flex h-14 items-center border-b px-4 font-semibold">Agents</div>
            <nav className="flex-1 space-y-1 p-2">
                {navItems.map((item) => (
                    <a
                        key={item.to}
                        href={item.to}
                        className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            pathname === item.to && 'bg-sidebar-accent text-sidebar-accent-foreground',
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </a>
                ))}
            </nav>
        </aside>
    );
}
