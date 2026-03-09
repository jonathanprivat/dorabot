import { useCallback, useEffect, useMemo, useState } from 'react';
import type { useGateway, TaskRun } from '../hooks/useGateway';
import { toast } from 'sonner';
import { Loader2, Target, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Goal, Task, GoalStatus, TaskStatus } from './goals/helpers';
import { getTaskPresentation, parseSessionKey, errorText } from './goals/helpers';
import { KanbanBoard, type ColumnId } from './goals/KanbanBoard';
import { TaskDetailSheet } from './goals/TaskDetailSheet';
import { PlanDialog } from './goals/PlanDialog';

type Props = {
  gateway: ReturnType<typeof useGateway>;
  onViewSession?: (sessionId: string, channel?: string, chatId?: string, chatType?: string) => void;
  onSetupChat?: (prompt: string) => void;
};

export function GoalsView({ gateway, onViewSession, onSetupChat }: Props) {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [planTask, setPlanTask] = useState<Task | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const taskRuns = gateway.taskRuns as Record<string, TaskRun>;

  const load = useCallback(async () => {
    if (gateway.connectionState !== 'connected') return;
    try {
      const [goalsRes, tasksRes] = await Promise.all([
        gateway.rpc('goals.list'),
        gateway.rpc('tasks.list'),
      ]);
      if (Array.isArray(goalsRes)) setGoals(goalsRes as Goal[]);
      if (Array.isArray(tasksRes)) setTasks(tasksRes as Task[]);
    } catch (err) {
      toast.error('Failed to load projects', { description: errorText(err) });
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!loading) void load(); }, [gateway.goalsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const goalsById = useMemo(() => new Map(goals.map(g => [g.id, g])), [goals]);

  const wrap = useCallback(async (key: string, fn: () => Promise<void>) => {
    setSaving(key);
    try { await fn(); await load(); }
    catch (err) { toast.error(errorText(err)); }
    finally { setSaving(null); }
  }, [load]);

  const startTask = useCallback((taskId: string, mode?: 'plan' | 'execute') => {
    void wrap(`task:${taskId}:start`, async () => {
      const res = await gateway.rpc('tasks.start', { id: taskId, mode: mode || 'execute' }) as { sessionId?: string; chatId?: string } | null;
      if (res?.sessionId && onViewSession) {
        onViewSession(res.sessionId, 'desktop', res.chatId, 'dm');
      }
    });
  }, [gateway, wrap, onViewSession]);

  const watchTask = useCallback((task: Task) => {
    if (!onViewSession) return;
    if (task.sessionId) {
      const parsed = task.sessionKey ? parseSessionKey(task.sessionKey) : null;
      onViewSession(task.sessionId, parsed?.channel || 'desktop', parsed?.chatId || task.sessionId, parsed?.chatType || 'dm');
      return;
    }
    const parsed = parseSessionKey(task.sessionKey);
    if (!parsed) return;
    const session = gateway.sessions.find((s: any) =>
      (s.channel || 'desktop') === parsed.channel
      && (s.chatType || 'dm') === parsed.chatType
      && s.chatId === parsed.chatId,
    );
    if (session?.id) onViewSession(session.id, parsed.channel, parsed.chatId, parsed.chatType);
  }, [gateway.sessions, onViewSession]);

  const unblockTask = useCallback((taskId: string) => {
    void wrap(`task:${taskId}:status`, async () => {
      await gateway.rpc('tasks.update', { id: taskId, status: 'todo' });
    });
  }, [gateway, wrap]);

  const saveTask = useCallback((taskId: string, updates: { title: string; goalId: string; reason: string; result: string }) => {
    void wrap(`task:${taskId}:save`, async () => {
      await gateway.rpc('tasks.update', { id: taskId, ...updates });
    });
  }, [gateway, wrap]);

  const blockTask = useCallback((taskId: string) => {
    void wrap(`task:${taskId}:status`, async () => {
      await gateway.rpc('tasks.update', { id: taskId, status: 'blocked' });
    });
  }, [gateway, wrap]);

  const deleteTask = useCallback((taskId: string) => {
    void wrap(`task:${taskId}:delete`, async () => {
      await gateway.rpc('tasks.delete', { id: taskId });
      if (selectedTask?.id === taskId) { setSelectedTask(null); setSheetOpen(false); }
    });
  }, [gateway, wrap, selectedTask]);

  const createGoal = useCallback((title: string, description?: string) => {
    void wrap('goal:create', async () => {
      await gateway.rpc('goals.add', { title, description });
    });
  }, [gateway, wrap]);

  const toggleGoalStatus = useCallback((goal: Goal) => {
    const next: GoalStatus = goal.status === 'paused' ? 'active' : 'paused';
    void wrap(`goal:${goal.id}`, async () => {
      await gateway.rpc('goals.update', { id: goal.id, status: next });
    });
  }, [gateway, wrap]);

  const completeGoal = useCallback((goal: Goal) => {
    void wrap(`goal:${goal.id}`, async () => {
      await gateway.rpc('goals.update', { id: goal.id, status: 'done' as GoalStatus });
    });
  }, [gateway, wrap]);

  const deleteGoal = useCallback((goalId: string) => {
    void wrap(`goal:delete:${goalId}`, async () => {
      await gateway.rpc('goals.delete', { id: goalId });
    });
  }, [gateway, wrap]);

  const createTask = useCallback((title: string, goalId?: string, status?: string) => {
    void wrap('task:create', async () => {
      await gateway.rpc('tasks.add', {
        title,
        status: (status || 'todo') as TaskStatus,
        goalId: goalId || undefined,
      });
    });
  }, [gateway, wrap]);

  const moveTask = useCallback((taskId: string, toColumn: ColumnId, newGoalId?: string) => {
    const statusMap: Record<ColumnId, TaskStatus> = {
      todo: 'todo',
      in_progress: 'in_progress',
      review: 'review',
      done: 'done',
    };
    void wrap(`task:${taskId}:move`, async () => {
      const updates: Record<string, unknown> = { id: taskId, status: statusMap[toColumn] };
      if (newGoalId !== undefined) updates.goalId = newGoalId || null;
      await gateway.rpc('tasks.update', updates);
    });
  }, [gateway, wrap]);

  const openTaskDetail = useCallback((task: Task) => {
    setSelectedTask(task);
    setSheetOpen(true);
  }, []);

  const openPlan = useCallback((task: Task) => {
    setPlanTask(task);
    setPlanOpen(true);
  }, []);

  if (gateway.connectionState !== 'connected') {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        connecting...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        loading...
      </div>
    );
  }

  const isEmpty = goals.length === 0 && tasks.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Target className="h-8 w-8 text-muted-foreground/30" />
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">no projects yet</div>
          <div className="text-[11px] text-muted-foreground/60">create a project to start tracking work</div>
        </div>
        <div className="flex items-center gap-3">
          {onSetupChat && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onSetupChat('create projects for me based on my history, ask me questions')}
            >
              <Sparkles className="mr-1.5 h-3 w-3" />
              generate projects
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <KanbanBoard
        tasks={tasks}
        goals={goals}
        taskRuns={taskRuns}
        goalsById={goalsById}
        onTaskClick={openTaskDetail}
        onStartTask={startTask}
        onWatchTask={watchTask}
        onUnblockTask={unblockTask}
        onViewPlan={openPlan}
        onCreateTask={createTask}
        onMoveTask={moveTask}
        onCreateGoal={createGoal}
        onToggleGoalStatus={toggleGoalStatus}
        onCompleteGoal={completeGoal}
        onDeleteGoal={deleteGoal}
        busy={saving}
      />

      <TaskDetailSheet
        task={selectedTask}
        presentation={selectedTask ? getTaskPresentation(selectedTask, taskRuns) : null}
        goals={goals}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        gateway={gateway}
        onSave={saveTask}
        onBlock={blockTask}
        onDelete={deleteTask}
        onViewPlan={openPlan}
        onViewSession={watchTask}
        busy={!!saving && !!selectedTask && saving.startsWith(`task:${selectedTask.id}:`)}
      />

      <PlanDialog
        task={planTask}
        open={planOpen}
        onOpenChange={setPlanOpen}
        gateway={gateway}
        onSaved={load}
      />
    </>
  );
}
