import { NextRequest, NextResponse } from 'next/server';

const RQLITE_URL = 'http://sgtent:4001';

function getTableName(projectId: string, type: 'workspace' | 'todo') {
  const sanitized = projectId.replace(/-/g, '_');
  return `dooit_${sanitized}_${type}`;
}

async function rqliteQuery(sql: string) {
  const res = await fetch(`${RQLITE_URL}/db/query?q=${encodeURIComponent(sql)}`);
  return res.json();
}

async function rqliteExecute(statements: string[]) {
  const res = await fetch(`${RQLITE_URL}/db/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(statements),
  });
  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const projectName = searchParams.get('project_name');

  if (!projectName) {
    return NextResponse.json({ error: 'project_name required' }, { status: 400 });
  }

  if (action === 'workspaces') {
    const table = getTableName(projectName, 'workspace');
    const sql = `SELECT id, description FROM ${table} WHERE is_root = false ORDER BY order_index`;
    const data = await rqliteQuery(sql);
    const result = data.results?.[0];
    const workspaces = result?.values?.map((row: [number, string]) => ({
      id: row[0],
      description: row[1],
    })) || [];
    return NextResponse.json({ workspaces });
  }

  if (action === 'todos') {
    const workspaceId = searchParams.get('workspace_id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }
    const table = getTableName(projectName, 'todo');
    const sql = `SELECT id, description, urgency, due, pending FROM ${table} WHERE parent_workspace_id = ${workspaceId} ORDER BY order_index`;
    const data = await rqliteQuery(sql);
    const result = data.results?.[0];
    const todos = result?.values?.map((row: [number, string, number, string | null, boolean]) => ({
      id: row[0],
      description: row[1],
      urgency: row[2],
      due: row[3],
      pending: row[4],
    })) || [];
    return NextResponse.json({ todos });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const body = await request.json();
  const projectName = body.project_name;

  if (!projectName) {
    return NextResponse.json({ error: 'project_name required' }, { status: 400 });
  }

  if (action === 'add_workspace') {
    const table = getTableName(projectName, 'workspace');
    const description = body.description?.replace(/'/g, "''") || '';
    const maxOrderSql = `SELECT COALESCE(MAX(order_index), -1) FROM ${table}`;
    const maxOrderData = await rqliteQuery(maxOrderSql);
    const maxOrder = maxOrderData.results?.[0]?.values?.[0]?.[0] ?? -1;
    const sql = `INSERT INTO ${table} (order_index, description, is_root, parent_workspace_id) VALUES (${maxOrder + 1}, '${description}', false, NULL)`;
    await rqliteExecute([sql]);
    return NextResponse.json({ success: true });
  }

  if (action === 'add_todo') {
    const table = getTableName(projectName, 'todo');
    const workspaceId = body.workspace_id;
    const description = body.description?.replace(/'/g, "''") || '';
    const maxOrderSql = `SELECT COALESCE(MAX(order_index), -1) FROM ${table} WHERE parent_workspace_id = ${workspaceId}`;
    const maxOrderData = await rqliteQuery(maxOrderSql);
    const maxOrder = maxOrderData.results?.[0]?.values?.[0]?.[0] ?? -1;
    const sql = `INSERT INTO ${table} (order_index, description, due, effort, recurrence, urgency, pending, parent_workspace_id, parent_todo_id) VALUES (${maxOrder + 1}, '${description}', NULL, 1, NULL, 1, true, ${workspaceId}, NULL)`;
    await rqliteExecute([sql]);
    return NextResponse.json({ success: true });
  }

  if (action === 'update_todo') {
    const table = getTableName(projectName, 'todo');
    const todoId = body.todo_id;
    const description = body.description?.replace(/'/g, "''") || '';
    const sql = `UPDATE ${table} SET description = '${description}' WHERE id = ${todoId}`;
    await rqliteExecute([sql]);
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_todo') {
    const table = getTableName(projectName, 'todo');
    const todoId = body.todo_id;
    const sql = `DELETE FROM ${table} WHERE id = ${todoId}`;
    await rqliteExecute([sql]);
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_workspace') {
    const table = getTableName(projectName, 'workspace');
    const workspaceId = body.workspace_id;
    const sql = `DELETE FROM ${table} WHERE id = ${workspaceId}`;
    await rqliteExecute([sql]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
