const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const token = (): string => localStorage.getItem('ps4_token') || '';

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  const authTok = token();
  if (authTok) {
    headers.Authorization = `Bearer ${authTok}`;
  }

  const res = await fetch(BASE_URL + path, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.detail || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

export async function apiUpload<T = any>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const authTok = token();
  if (authTok) {
    headers.Authorization = `Bearer ${authTok}`;
  }

  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers,
    body: formData
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.detail || `Upload failed with status ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

export async function downloadCsv(reportType: 'applications' | 'compliance'): Promise<void> {
  const authTok = token();
  const res = await fetch(`${BASE_URL}/reports/export-csv?report_type=${reportType}`, {
    headers: authTok ? { Authorization: `Bearer ${authTok}` } : {}
  });
  if (!res.ok) {
    throw new Error('Failed to generate CSV export.');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aicte_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
