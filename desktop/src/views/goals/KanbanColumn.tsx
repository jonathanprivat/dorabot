import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Task, Goal } from './helpers';
import type { ColumnId } from './KanbanBoard';
import { KanbanCard } from './KanbanCard';

type Props = {
  id: ColumnId;
  droppableId: string;
  title: string;
  icon: LucideIcon;
  iconColor: string;
  tasks: Task[];
  goalsById: Map<string, Goal>;
  onTaskClick: (task: Task) => void;
  onStartTask: (taskId: string, mode?: 'plan' | 'execute') => void;
  onWatchTask: (task: Task) => void;
  onUnblockTask: (taskId: string) => void;
  onViewPlan: (task: Task) => void;
  onCreateTask: (title: string) => void;
  busy?: string | null;
};

export function KanbanColumn({
  id, droppableId, title, icon: Icon, iconColor, tasks, goalsById,
  onTaskClick, onStartTask, onWatchTask, onUnblockTask,
  onViewPlan, onCreateTask, busy,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    onCreateTask(t);
    setNewTitle('');
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col flex-1 min-w-[180px]">
      {/* column header */}
      <div className="flex items-center gap-1.5 px-1.5 py-1 mb-1">
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
        {tasks.length > 0 && (
          <span className="text-[10px] text-muted-foreground/40">{tasks.length}</span>
        )}
        <button
          type="button"
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50 transition-colors ml-auto"
          onClick={() => setShowAdd(v => !v)}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* inline add form */}
      {showAdd && (
        <div className="px-1 mb-1.5">
          <div className="rounded-lg border border-primary/30 bg-card p-2">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setShowAdd(false); setNewTitle(''); }
              }}
              placeholder="Task title..."
              className="h-6 text-[11px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              autoFocus
            />
            <div className="flex items-center gap-1 mt-1">
              <Button size="sm" className="h-5 text-[10px] px-2" onClick={handleAdd} disabled={!newTitle.trim()}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] px-2"
                onClick={() => { setShowAdd(false); setNewTitle(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* droppable card area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-1.5 px-0.5 pb-2 min-h-[40px] rounded-md transition-colors',
          isOver && 'bg-primary/5 ring-1 ring-primary/20',
        )}
      >
        {tasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            columnId={id}
            goal={task.goalId ? goalsById.get(task.goalId) : undefined}
            onClick={() => onTaskClick(task)}
            onStart={(mode) => onStartTask(task.id, mode)}
            onWatch={() => onWatchTask(task)}
            onUnblock={() => onUnblockTask(task.id)}
            onViewPlan={() => onViewPlan(task)}
            busy={!!busy && busy.startsWith(`task:${task.id}:`)}
          />
        ))}
      </div>
    </div>
  );
}
