export async function apiGet<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const headers: any = {};
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}
  const res = await fetch(`${base}${path}`, { credentials: 'include', headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const headers: any = { 'Content-Type': 'application/json' };
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function apiPatch<T>(path: string, body?: any): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const headers: any = { 'Content-Type': 'application/json' };
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}
  const res = await fetch(`${base}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const headers: any = {};
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}
  const res = await fetch(`${base}${path}`, { method: 'DELETE', credentials: 'include', headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}
