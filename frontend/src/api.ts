const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const token = (): string => localStorage.getItem('ps4_token') || '';

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {})
  };

  const authTok = token();
  if (authTok) {
    headers.Authorization = `Bearer ${authTok}`;
  }

  const res = await fetch(BASE_URL + path, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    let message = `Request failed with status ${res.status}`;
    if (typeof errorBody.detail === 'string') {
      message = errorBody.detail;
    } else if (Array.isArray(errorBody.detail)) {
      message = errorBody.detail
        .map((errItem: any) => {
          const field = errItem.loc ? errItem.loc.filter((l: any) => l !== 'body').join('.') : '';
          return field ? `${field}: ${errItem.msg}` : errItem.msg;
        })
        .join('; ');
    } else if (errorBody.message) {
      message = errorBody.message;
    }
    const err: any = new Error(message);
    err.status = res.status;
    if (res.status === 401) {
      localStorage.removeItem('ps4_token');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }
    throw err;
  }
  return res.json();
}

// --- V1 Typed API Helpers for Institution Portal Journey ---

export async function fetchApplications(params?: { stage?: string; status?: string; app_type?: string; search?: string }): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.stage && params.stage !== 'ALL') query.append('stage', params.stage);
  if (params?.status && params.status !== 'ALL') query.append('status', params.status);
  if (params?.app_type && params.app_type !== 'ALL') query.append('app_type', params.app_type);
  if (params?.search) query.append('search', params.search);
  const qStr = query.toString() ? `?${query.toString()}` : '';
  return api(`/v1/applications${qStr}`);
}

export async function createApplication(data: {
  application_type: string;
  academic_year?: string;
  notes?: string;
  region?: string;
  due_date?: string | null;
  is_draft?: boolean;
}): Promise<any> {
  return api('/v1/applications', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function fetchApplicationDetail(id: number): Promise<any> {
  return api(`/v1/applications/${id}`);
}

export async function patchApplication(id: number, data: {
  application_type?: string;
  academic_year?: string;
  notes?: string;
  due_date?: string | null;
}): Promise<any> {
  return api(`/v1/applications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export async function uploadApplicationDocument(id: number, file: File, documentType: string, documentName?: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  if (documentName) formData.append('document_name', documentName);
  return api(`/v1/applications/${id}/documents`, {
    method: 'POST',
    body: formData
  });
}

export async function submitApplication(id: number): Promise<any> {
  return api(`/v1/applications/${id}/submit`, {
    method: 'POST'
  });
}

export async function resubmitApplication(id: number, reason: string): Promise<any> {
  return api(`/v1/applications/${id}/resubmit`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function fetchApplicationTimeline(id: number): Promise<any[]> {
  return api(`/v1/applications/${id}/timeline`);
}

export async function fetchNotifications(): Promise<any[]> {
  return api('/v1/notifications');
}

export async function markNotificationRead(id: number): Promise<any> {
  return api(`/v1/notifications/${id}/read`, {
    method: 'PATCH'
  });
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

export async function fetchNextBestAction(id: number): Promise<any> {
  return api(`/v1/applications/${id}/next-action`);
}

export async function fetchExtractedFields(id: number): Promise<any[]> {
  return api(`/v1/applications/${id}/extracted-fields`);
}

export async function applyExtractedFields(id: number, fields: Record<string, string>): Promise<any> {
  return api(`/v1/applications/${id}/apply-extracted-fields`, {
    method: 'POST',
    body: JSON.stringify({ fields })
  });
}

export async function fetchBottleneckAnalytics(): Promise<any> {
  return api('/v1/analytics/bottlenecks');
}

export async function verifyAuditChain(id: number): Promise<any> {
  return api(`/v1/applications/${id}/audit/verify`);
}

export async function runOfficerScrutiny(id: number, runType: string = 'INITIAL'): Promise<any> {
  return api(`/v1/officer/applications/${id}/scrutiny`, {
    method: 'POST',
    body: JSON.stringify({ run_type: runType })
  });
}

export async function setFindingDisposition(
  findingId: number,
  disposition: 'ACCEPTED' | 'WAIVED' | 'CORRECTION_REQUESTED' | 'RESOLVED',
  dispositionNotes?: string
): Promise<any> {
  return api(`/findings/${findingId}/disposition`, {
    method: 'POST',
    body: JSON.stringify({
      disposition,
      disposition_notes: dispositionNotes || null
    })
  });
}

export async function recordOfficerDecision(
  id: number,
  decision: 'APPROVED' | 'REJECTED',
  remarks: string,
  approvalOrderReference?: string
): Promise<any> {
  return api(`/v1/officer/applications/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({
      decision,
      remarks,
      approval_order_reference: approvalOrderReference || null
    })
  });
}

export async function requestOfficerCorrections(
  id: number,
  reason: string,
  deficiencies: any[] = []
): Promise<any> {
  return api(`/v1/officer/applications/${id}/request-corrections`, {
    method: 'POST',
    body: JSON.stringify({
      reason,
      deficiencies
    })
  });
}

export async function fetchCompliance(params?: { status?: string; item_type?: string }): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'ALL') query.append('status', params.status);
  if (params?.item_type && params.item_type !== 'ALL') query.append('item_type', params.item_type);
  const qStr = query.toString() ? `?${query.toString()}` : '';
  return api(`/compliance${qStr}`);
}

export async function submitComplianceEvidence(complianceId: number, submissionEvidence: string): Promise<any> {
  return api(`/compliance/${complianceId}/submit-evidence`, {
    method: 'POST',
    body: JSON.stringify({ submission_evidence: submissionEvidence })
  });
}

export async function verifyComplianceEvidence(
  complianceId: number,
  action: 'VERIFY' | 'REJECT',
  officerComments?: string
): Promise<any> {
  return api(`/compliance/${complianceId}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, officer_comments: officerComments || null })
  });
}

export async function updateEvcVisitRecord(
  visitId: number,
  data: {
    status?: string;
    report_summary?: string;
    recommendations?: string;
    conducted_date?: string;
  }
): Promise<any> {
  return api(`/evc/${visitId}/update`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}


