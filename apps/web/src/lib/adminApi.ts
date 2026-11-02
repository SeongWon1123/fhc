export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`운영 API 요청에 실패했습니다 (${status}).`);
    this.status = status;
  }
}

const apiBaseUrl = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export async function requestAdmin(path: string, token: string, signal?: AbortSignal): Promise<unknown> {
  if (!token) throw new AdminApiError(401);
  const response = await fetch(`${apiBaseUrl}/admin/${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new AdminApiError(response.status);
  return response.json();
}

export async function postAdmin(path: string, token: string): Promise<unknown> {
  if (!token) throw new AdminApiError(401);
  const response = await fetch(`${apiBaseUrl}/admin/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new AdminApiError(response.status);
  return response.json();
}

export type CoachDecision = 'approve' | 'reject';

export function decideCoachApplication(coachId: string, decision: CoachDecision, token: string): Promise<unknown> {
  return postAdmin(`coaches/${encodeURIComponent(coachId)}/${decision}`, token);
}

export type OperatorAccess = {
  role: 'admin' | 'gym_owner';
  gym_ids: string[];
};

export async function checkOperatorAccess(token: string, signal?: AbortSignal): Promise<OperatorAccess> {
  const data = await requestAdmin('access', token, signal);
  if (
    typeof data !== 'object' || data === null ||
    !('role' in data) || (data.role !== 'admin' && data.role !== 'gym_owner') ||
    !('gym_ids' in data) || !Array.isArray(data.gym_ids) ||
    !data.gym_ids.every((id: unknown) => typeof id === 'string')
  ) {
    throw new AdminApiError(502);
  }
  return { role: data.role, gym_ids: data.gym_ids };
}
