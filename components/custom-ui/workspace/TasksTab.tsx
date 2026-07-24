'use client'

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { logActivity } from '@/lib/activity';
import { toast } from 'react-toastify';
import { Plus, Trash2 } from 'lucide-react';

interface Task {
  id: string;
  projectId: string;
  title: string;
  done: boolean;
  order: number;
  createdAt?: any;
}

interface TasksTabProps {
  project: Project;
}

export function TasksTab({ project }: TasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'project_tasks'), where('projectId', '==', project.id)),
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as Task[];
        rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setTasks(rows);
      },
      (err) => console.error('project_tasks snapshot error', err)
    );
    return unsub;
  }, [project.id]);

  // A project's completion % is derived from its task list whenever tasks exist.
  const syncCompletion = async (list: Task[]) => {
    if (list.length === 0) return;
    const pct = Math.round((list.filter((t) => t.done).length / list.length) * 100);
    try {
      await updateDoc(doc(db, 'projects', project.id), { completion: pct });
    } catch (error) {
      console.error('Error syncing completion:', error);
    }
  };

  const addTask = async () => {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'project_tasks'), {
        projectId: project.id, title: t, done: false, order: tasks.length, createdAt: serverTimestamp(),
      });
      setTitle('');
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (task: Task) => {
    const next = tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t));
    try {
      await updateDoc(doc(db, 'project_tasks', task.id), { done: !task.done });
      await syncCompletion(next);
      if (!task.done) await logActivity('project', project.id, 'task', `Completed task: ${task.title}`);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task.');
    }
  };

  const remove = async (task: Task) => {
    const next = tasks.filter((t) => t.id !== task.id);
    try {
      await deleteDoc(doc(db, 'project_tasks', task.id));
      await syncCompletion(next);
    } catch (error) {
      console.error('Error removing task:', error);
      toast.error('Failed to remove task.');
    }
  };

  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-spaceText">Tasks &amp; milestones</p>
        {tasks.length > 0 && (
          <span className="text-xs text-spaceAlt/80">{doneCount}/{tasks.length} · {pct}%</span>
        )}
      </div>

      {tasks.length > 0 && <Progress value={pct} className="h-2 bg-space1" />}

      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
          placeholder="Add a task or milestone…"
          className="bg-space1 border-spaceAccent text-spaceText"
        />
        <Button size="sm" onClick={addTask} disabled={busy || !title.trim()} className="bg-spaceAccent hover:bg-spaceAlt text-spaceText">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-spaceAlt/70">
          No tasks yet. Add milestones — checking them off updates the project’s completion automatically.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2 rounded-lg border border-spaceAccent/25 bg-space1/50 px-3 py-2">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggle(task)}
                className="h-4 w-4 shrink-0 accent-spaceAccent"
              />
              <span className={`min-w-0 flex-1 truncate text-sm ${task.done ? 'text-spaceAlt/60 line-through' : 'text-spaceText'}`}>
                {task.title}
              </span>
              <button onClick={() => remove(task)} className="shrink-0 text-red-400 hover:text-red-300" aria-label="Remove task">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
