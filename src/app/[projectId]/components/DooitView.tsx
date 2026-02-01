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

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [modalText, setModalText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);

  const [expandedTodoId, setExpandedTodoId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [workspaceText, setWorkspaceText] = useState('');

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

  const addWorkspace = async () => {
    if (!workspaceText.trim()) return;
    await fetch('/api/dooit?action=add_workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: projectId,
        description: workspaceText.trim(),
      }),
    });
    setShowWorkspaceModal(false);
    setWorkspaceText('');
    await fetchWorkspaces();
  };

  const openAddModal = () => {
    setModalMode('add');
    setModalText('');
    setEditingTodoId(null);
  };

  const openEditModal = (todo: Todo) => {
    setModalMode('edit');
    setModalText(todo.description);
    setEditingTodoId(todo.id);
    setExpandedTodoId(null);
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
    setDeleteConfirmId(null);
    setExpandedTodoId(null);
    await fetchTodos();
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-foreground/50">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-foreground/10">
        <div className="flex-1 flex overflow-x-auto scrollbar-hide">
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
        <button
          onClick={() => setShowWorkspaceModal(true)}
          className="shrink-0 px-3 py-2.5 text-foreground/50 hover:text-foreground"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
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
            <div className="flex justify-end">
              <button
                onClick={openAddModal}
                className="p-1 text-foreground/50 hover:text-foreground"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="text-sm bg-foreground/5 border border-foreground/10 rounded overflow-hidden"
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                  onClick={() => setExpandedTodoId(expandedTodoId === todo.id ? null : todo.id)}
                >
                  <span className="flex-1">{todo.description}</span>
                  <svg
                    className={`w-4 h-4 text-foreground/30 transition-transform ${expandedTodoId === todo.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {expandedTodoId === todo.id && (
                  <div className="flex justify-end gap-2 px-3 py-2 border-t border-foreground/10">
                    <button
                      onClick={() => openEditModal(todo)}
                      className="px-3 py-1 text-xs bg-foreground/10 hover:bg-foreground/20 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(todo.id)}
                      className="px-3 py-1 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded"
                    >
                      Delete
                    </button>
                  </div>
                )}
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

      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-foreground/20 rounded-lg p-4 w-80 max-w-[90vw]">
            <p className="text-sm mb-4">Are you sure you want to delete this todo?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-sm text-foreground/70 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTodo(deleteConfirmId)}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showWorkspaceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-foreground/20 rounded-lg p-4 w-80 max-w-[90vw]">
            <input
              type="text"
              value={workspaceText}
              onChange={(e) => setWorkspaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addWorkspace();
                if (e.key === 'Escape') {
                  setShowWorkspaceModal(false);
                  setWorkspaceText('');
                }
              }}
              placeholder="Workspace name..."
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full px-3 py-2 text-sm bg-foreground/5 border border-foreground/10 rounded mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowWorkspaceModal(false);
                  setWorkspaceText('');
                }}
                className="px-3 py-1.5 text-sm text-foreground/70 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={addWorkspace}
                disabled={!workspaceText.trim()}
                className="px-3 py-1.5 text-sm bg-foreground text-background rounded disabled:opacity-30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
