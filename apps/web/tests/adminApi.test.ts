import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import { AdminApiError, checkOperatorAccess, decideCoachApplication } from '../src/lib/adminApi';
import { loadOperationsData } from '../src/lib/operationsData';

const fetchSpy = spyOn(globalThis, 'fetch');
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

describe('operator API boundary', () => {
  test.each([
    { role: 'admin', gym_ids: [] },
    { role: 'gym_owner', gym_ids: ['gym-a'] },
    { role: 'gym_owner', gym_ids: [] },
  ])('verifies $role with the session bearer token through the gateway', async (access) => {
    fetchSpy.mockResolvedValueOnce(Response.json(access));
    expect(await checkOperatorAccess('operator-token')).toEqual(access);
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/admin/access', expect.objectContaining({
      headers: { Accept: 'application/json', Authorization: 'Bearer operator-token' },
      cache: 'no-store',
    }));
  });

  test.each([
    { role: 'member', gym_ids: [] },
    { role: 'coach', gym_ids: ['gym-a'] },
    { role: 'admin', gym_ids: [1] },
    {},
    null,
  ])('rejects an invalid access response %#', async (access) => {
    fetchSpy.mockResolvedValueOnce(Response.json(access));
    await expect(checkOperatorAccess('token')).rejects.toMatchObject({ status: 502 });
  });

  test.each([401, 403, 503])('preserves access failure status %i', async (status) => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status }));
    await expect(checkOperatorAccess('token')).rejects.toMatchObject({ status });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('never requests operator data without a token', async () => {
    await expect(loadOperationsData('')).rejects.toMatchObject({ status: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('loads the server scoped overview with the current token', async () => {
    const member = { id: 'member-a', name: '회원', email: 'member@example.test', fitness_goal: '근력', join_date: '2026-10-23' };
    const overview = { source: 'supabase', coaches: [], members: [member], bookings: [], clothing_items: [] };
    fetchSpy.mockResolvedValueOnce(Response.json(overview));
    expect(await loadOperationsData('current-user')).toEqual({
      source: 'supabase', coaches: [], coachApplications: [], members: [member], bookings: [], clothingItems: [],
    });
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/admin/overview', expect.objectContaining({
      headers: { Accept: 'application/json', Authorization: 'Bearer current-user' },
    }));
  });

  test.each([401, 403, 503])('does not turn overview status %i into empty successful data', async (status) => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status }));
    await expect(loadOperationsData('token')).rejects.toMatchObject({ status });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('propagates a network failure without querying another data source', async () => {
    const failure = new TypeError('offline');
    fetchSpy.mockRejectedValueOnce(failure);
    await expect(loadOperationsData('token')).rejects.toBe(failure);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test.each([
    {},
    { source: 'demo-fallback', coaches: [], members: [], bookings: [], clothing_items: [] },
    { source: 'supabase', coaches: [], members: null, bookings: [], clothing_items: [] },
  ])('rejects an invalid overview rather than showing an empty dashboard %#', async (overview) => {
    fetchSpy.mockResolvedValueOnce(Response.json(overview));
    await expect(loadOperationsData('token')).rejects.toBeInstanceOf(AdminApiError);
  });

  test('keeps requests isolated across users without cached data or credentials', async () => {
    fetchSpy.mockImplementation(async () => Response.json({
      source: 'supabase', coaches: [], members: [], bookings: [], clothing_items: [],
    }));
    await loadOperationsData('first-user');
    await loadOperationsData('second-user');
    expect(fetchSpy.mock.calls.map(([, options]) => options?.headers)).toEqual([
      { Accept: 'application/json', Authorization: 'Bearer first-user' },
      { Accept: 'application/json', Authorization: 'Bearer second-user' },
    ]);
  });

  test('passes cancellation to the operator request', async () => {
    const controller = new AbortController();
    fetchSpy.mockResolvedValueOnce(Response.json({ role: 'admin', gym_ids: [] }));
    await checkOperatorAccess('token', controller.signal);
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/admin/access', expect.objectContaining({ signal: controller.signal }));
  });

  test.each(['approve', 'reject'] as const)('posts the %s coach decision with the operator token', async (decision) => {
    fetchSpy.mockResolvedValueOnce(Response.json({ id: 'coach a' }));
    await decideCoachApplication('coach a', decision, 'operator-token');
    expect(fetchSpy).toHaveBeenCalledWith(`/api/v1/admin/coaches/coach%20a/${decision}`, expect.objectContaining({
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer operator-token' },
    }));
  });

  test('surfaces a refused coach decision and never posts without a token', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(decideCoachApplication('coach-a', 'approve', 'token')).rejects.toMatchObject({ status: 403 });
    await expect(decideCoachApplication('coach-a', 'approve', '')).rejects.toMatchObject({ status: 401 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('reads pending coach applications from the overview', async () => {
    const applicant = { id: 'applicant', name: '신청 코치', specialty: 'gym', rating: 0, booking_count: 0, is_verified: false, location: '순천', base_price: 30000 };
    fetchSpy.mockResolvedValueOnce(Response.json({
      source: 'supabase', coaches: [], coach_applications: [applicant], members: [], bookings: [], clothing_items: [],
    }));
    expect((await loadOperationsData('token')).coachApplications).toEqual([applicant]);
  });
});
