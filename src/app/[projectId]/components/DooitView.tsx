'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [modalText, setModalText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);

  const [contextMenu, setContextMenu] = useState<{ todoId: number; x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

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

  const openAddModal = () => {
    setModalMode('add');
    setModalText('');
    setEditingTodoId(null);
  };

  const openEditModal = (todo: Todo) => {
    setModalMode('edit');
    setModalText(todo.description);
    setEditingTodoId(todo.id);
    setContextMenu(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setModalText('');
    setEditingTodoId(null);
  };

  const handleModalSave = async () => {
    if (!modalText.trim() || selectedWorkspace === null) return;
    if (modalMode === 'add') {
      await fetch('/api/dooit?action=add_todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectId,
          workspace_id: selectedWorkspace,
          description: modalText.trim(),
        }),
      });
    } else if (modalMode === 'edit' && editingTodoId !== null) {
      await fetch('/api/dooit?action=update_todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectId,
          todo_id: editingTodoId,
          description: modalText.trim(),
        }),
      });
    } else {
      throw new Error(`Unexpected modalMode: ${modalMode}`);
    }
    closeModal();
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
    setContextMenu(null);
    await fetchTodos();
  };

  const handleContextMenu = (e: React.MouseEvent, todoId: number) => {
    e.preventDefault();
    setContextMenu({ todoId, x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (todoId: number) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ todoId, x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  if (loading) {
    return (
      <div className="p-4 text-center text-foreground/50">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex overflow-x-auto scrollbar-hide border-b border-foreground/10">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => setSelectedWorkspace(ws.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
              selectedWorkspace === ws.id
                ? 'text-foreground border-b-2 border-foreground'
                : 'text-foreground/50'
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
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-foreground/5 border border-foreground/10 rounded"
                onContextMenu={(e) => handleContextMenu(e, todo.id)}
                onTouchStart={() => handleTouchStart(todo.id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
              >
                <span className="flex-1">{todo.description}</span>
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
          <button
            onClick={openAddModal}
            className="w-full px-3 py-1.5 text-sm bg-foreground text-background rounded"
          >
            Add Todo
          </button>
        </div>
      )}

      {modalMode !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-foreground/20 rounded-lg p-4 w-80 max-w-[90vw]">
            <input
              type="text"
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleModalSave();
                if (e.key === 'Escape') closeModal();
              }}
              placeholder="Todo description..."
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeModal}
                className="px-3 py-1.5 text-sm text-foreground/70 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSave}
                disabled={!modalText.trim()}
                className="px-3 py-1.5 text-sm bg-foreground text-background rounded disabled:opacity-30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-background border border-foreground/20 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              const todo = todos.find((t) => t.id === contextMenu.todoId);
              if (todo) openEditModal(todo);
            }}
            className="w-full px-4 py-2 text-sm text-left hover:bg-foreground/10"
          >
            Edit
          </button>
          <button
            onClick={() => deleteTodo(contextMenu.todoId)}
            className="w-full px-4 py-2 text-sm text-left hover:bg-foreground/10 text-red-500"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
