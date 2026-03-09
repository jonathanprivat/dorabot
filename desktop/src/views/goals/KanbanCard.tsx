import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Play, Eye, RotateCcw, FileText,
  ChevronDown, Pencil, GripVertical, AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Task, Goal } from './helpers';
import type { ColumnId } from './KanbanBoard';

type Props = {
  task: Task;
  columnId: ColumnId;
  goal?: Goal;
  onClick: () => void;
  onStart?: (mode?: 'plan' | 'execute') => void;
  onWatch?: () => void;
  onUnblock?: () => void;
  onViewPlan?: () => void;
  busy?: boolean;
};

function shortId(id: string): string {
  const raw = id.replace(/^(task_|tsk_)/, '');
  return raw.slice(0, 6).toUpperCase();
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function KanbanCard({
  task, columnId, goal, onClick,
  onStart, onWatch, onUnblock, onViewPlan,
  busy,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task, fromColumn: columnId },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const isRunning = task.status === 'in_progress';
  const isBlocked = task.status === 'blocked';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border border-border/80 bg-card p-2.5 transition-all',
        'hover:shadow-sm hover:border-border cursor-pointer',
        isDragging && 'opacity-40 shadow-lg z-50',
        isRunning && 'border-l-2 border-l-amber-500',
        isBlocked && 'border-l-2 border-l-destructive',
      )}
      onClick={onClick}
    >
      {/* top row: drag handle + ID + badges + time */}
      <div className="flex items-center gap-1 mb-1">
        <div
          {...listeners}
          {...attributes}
          className="opacity-0 group-hover:opacity-30 hover:!opacity-80 cursor-grab active:cursor-grabbing -ml-0.5 p-0.5"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/50">
          {shortId(task.id)}
        </span>
        {isBlocked && (
          <span className="flex items-center gap-0.5 text-[9px] text-destructive/70">
            <AlertTriangle className="h-2.5 w-2.5" />
            blocked
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/40 ml-auto">
          {timeAgo(task.updatedAt)}
        </span>
      </div>

      {/* title */}
      <div className="text-[12px] leading-snug font-medium pl-0.5">
        {task.title}
      </div>

      {/* actions (hover-revealed) */}
      <div
        className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        {/* todo column: run button */}
        {columnId === 'todo' && onStart && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={() => onStart('execute')}
              disabled={busy}
            >
              <Play className="mr-0.5 h-2.5 w-2.5" />
              Run
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-5 w-4 p-0" disabled={busy}>
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onStart('plan')}>
                  <Pencil className="mr-2 h-3 w-3" /> Plan first
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStart('execute')}>
                  <Play className="mr-2 h-3 w-3" /> Execute now
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* in_progress: watch */}
        {columnId === 'in_progress' && onWatch && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1.5"
            onClick={onWatch}
            disabled={busy}
          >
            <Eye className="mr-0.5 h-2.5 w-2.5" />
            Watch
          </Button>
        )}

        {/* blocked badge in todo: unblock button */}
        {isBlocked && onUnblock && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1.5"
            onClick={onUnblock}
            disabled={busy}
          >
            <RotateCcw className="mr-0.5 h-2.5 w-2.5" />
            Unblock
          </Button>
        )}

        {/* view plan (any column, if has plan) */}
        {onViewPlan && task.plan && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1.5 ml-auto text-muted-foreground"
            onClick={onViewPlan}
            disabled={busy}
          >
            <FileText className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
