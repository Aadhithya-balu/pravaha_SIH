import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiModule from '../api';

describe('EVC Staff Allocation & RBAC Frontend API Suite', () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn().mockImplementation((url: string, options: any) => {
      let bodyData = {};
      try {
        if (options?.body) {
          bodyData = JSON.parse(options.body);
        }
      } catch (e) {
        bodyData = {};
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          requested_url: url,
          method: options?.method || 'GET',
          ...bodyData
        })
      });
    });
    globalThis.fetch = mockFetch;
  });

  it('fetchEvcEligibility calls the correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ eligible: true, reasons: ['Scrutiny cleared'], pending_items: [] })
    });

    const result = await apiModule.fetchEvcEligibility(42);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/applications/42/evc-eligibility'),
      expect.any(Object)
    );
    expect(result.eligible).toBe(true);
  });

  it('fetchEvcStaff appends region and availability query params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: 'Dr. Expert', availability_status: 'AVAILABLE', active_assignments_count: 0 }
      ])
    });

    const result = await apiModule.fetchEvcStaff({ region: 'Northern', availability: 'AVAILABLE' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/evc/staff?region=Northern&availability=AVAILABLE'),
      expect.any(Object)
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dr. Expert');
  });

  it('autoAssignEvc posts to auto-assign endpoint with scheduled_date and remarks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 99, application_id: 10, assignment_method: 'AI', assignment_status: 'ASSIGNMENT_PENDING' })
    });

    const result = await apiModule.autoAssignEvc(10, {
      proposed_date: '2026-11-20',
      remarks: 'Automated test assignment'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/applications/10/evc/auto-assign'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ proposed_date: '2026-11-20', remarks: 'Automated test assignment' })
      })
    );
    expect(result.id).toBe(99);
  });

  it('manualAssignEvc posts to manual-assign endpoint with staff_id and proposed_date', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 100, application_id: 15, assigned_staff_id: 5, assignment_method: 'MANUAL' })
    });

    const result = await apiModule.manualAssignEvc(15, {
      staff_id: 5,
      proposed_date: '2026-11-22',
      remarks: 'Manual assignment via roster'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/applications/15/evc/manual-assign'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          staff_id: 5,
          proposed_date: '2026-11-22',
          remarks: 'Manual assignment via roster'
        })
      })
    );
    expect(result.assigned_staff_id).toBe(5);
  });

  it('respondToEvcAssignment sends ACCEPT and DECLINE actions with justification', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 7, assignment_status: 'ACCEPTED' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 7, assignment_status: 'DECLINED', decline_reason: 'Conflict' })
      });

    const acceptRes = await apiModule.respondToEvcAssignment(7, 'ACCEPT');
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/evc/7/respond'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'ACCEPT' })
      })
    );
    expect(acceptRes.assignment_status).toBe('ACCEPTED');

    const declineRes = await apiModule.respondToEvcAssignment(7, 'DECLINE', 'Conflict');
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/evc/7/respond'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'DECLINE', reason: 'Conflict' })
      })
    );
    expect(declineRes.assignment_status).toBe('DECLINED');
  });

  it('updateEvcStaffAvailability calls /evc/staff/availability', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 3, availability_status: 'BUSY' })
    });

    const result = await apiModule.updateEvcStaffAvailability('BUSY');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/evc/staff/availability'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ availability_status: 'BUSY' })
      })
    );
    expect(result.availability_status).toBe('BUSY');
  });

  it('fetchAdminRoleMatrix calls /admin/role-matrix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'AUTHORIZED', matrix: [] })
    });

    const result = await apiModule.fetchAdminRoleMatrix();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/role-matrix'),
      expect.any(Object)
    );
    expect(result.status).toBe('AUTHORIZED');
  });
});
