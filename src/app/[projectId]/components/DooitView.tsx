'use client';

import { useState, useEffect, useCallback } from 'react';

interface Todo {
  id: number;
  description: string;
  status: number;
  urgency: number;
  due?: string;
  parent_id?: number;
}

interface Workspace {
  id: number;
  description: string;
}

export function DooitView({ projectId }: { projectId: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [todosLoading, setTodosLoading] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [editingTodo, setEditingTodo] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const fetchWorkspaces = useCallback(async () => {
    const res = await fetch(
      `/api/dooit?action=workspaces&project_name=${encodeURIComponent(projectId)}`
    );
    const data = await res.json();
    const list: Workspace[] = data.workspaces || [];
    setWorkspaces(list);
    if (list.length > 0 && selectedWorkspace === null) {
      setSelectedWorkspace(list[0].id);
    }
    setLoading(false);
  }, [projectId, selectedWorkspace]);

  const fetchTodos = useCallback(async () => {
    if (selectedWorkspace === null) return;
    setTodosLoading(true);
    const res = await fetch(
      `/api/dooit?action=todos&project_name=${encodeURIComponent(projectId)}&workspace_id=${selectedWorkspace}`
    );
    const data = await res.json();
    setTodos(data.todos || []);
    setTodosLoading(false);
  }, [projectId, selectedWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (selectedWorkspace !== null) {
      fetchTodos();
    }
  }, [selectedWorkspace, fetchTodos]);

  const addTodo = async () => {
    if (!newTodoText.trim() || selectedWorkspace === null) return;
    await fetch('/api/dooit?action=add_todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: projectId,
        workspace_id: selectedWorkspace,
        description: newTodoText.trim(),
      }),
    });
    setNewTodoText('');
    await fetchTodos();
  };

  const updateTodo = async (todoId: number, description: string) => {
    await fetch('/api/dooit?action=update_todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: projectId,
        todo_id: todoId,
        description,
      }),
    });
    setEditingTodo(null);
    await fetchTodos();
  };

  const deleteTodo = async (todoId: number) => {
    await fetch('/api/dooit?action=delete_todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: projectId,
        todo_id: todoId,
      }),
    });
    await fetchTodos();
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-foreground/50">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-3 border-b border-foreground/10 overflow-x-auto">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => setSelectedWorkspace(ws.id)}
            className={`px-3 py-1.5 text-sm rounded shrink-0 ${
              selectedWorkspace === ws.id
                ? 'bg-foreground text-background'
                : 'bg-foreground/10 hover:bg-foreground/20'
            }`}
          >
            {ws.description}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {selectedWorkspace === null ? (
          <div className="text-center text-foreground/50">
            Select a list to view todos
          </div>
        ) : todosLoading ? (
          <div className="text-center text-foreground/50">Loading todos...</div>
        ) : (
          <div className="space-y-2">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 p-3 bg-foreground/5 border border-foreground/10 rounded-lg group"
              >
                {editingTodo === todo.id ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateTodo(todo.id, editText);
                      if (e.key === 'Escape') setEditingTodo(null);
                    }}
                    onBlur={() => updateTodo(todo.id, editText)}
                    autoFocus
                    className="flex-1 bg-transparent border-b border-foreground/30 outline-none"
                  />
                ) : (
                  <span
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setEditingTodo(todo.id);
                      setEditText(todo.description);
                    }}
                  >
                    {todo.description}
                  </span>
                )}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="p-1 text-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
            {todos.length === 0 && (
              <div className="text-center text-foreground/50 py-8">
                No todos yet
              </div>
            )}
          </div>
        )}
      </div>

      {selectedWorkspace !== null && (
        <div className="p-3 border-t border-foreground/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              placeholder="Add todo..."
              className="flex-1 px-3 py-2 bg-foreground/5 border border-foreground/10 rounded-lg"
            />
            <button
              onClick={addTodo}
              disabled={!newTodoText.trim()}
              className="px-4 py-2 bg-foreground text-background rounded-lg disabled:opacity-30"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
