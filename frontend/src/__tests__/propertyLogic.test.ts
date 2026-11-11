import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../services/api';
import { propertyService } from '../services/propertyService';
import { taskService } from '../services/taskService';
import { bookingService } from '../services/bookingService';
import { inventoryService } from '../services/inventoryService';
import { financeService } from '../services/financeService';
import { dashboardService } from '../services/dashboardService';

vi.mock('../services/api', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: mockApi,
    api: mockApi,
  };
});

describe('Frontend Real Services & Domain Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propertyService.listProperties sends filter parameters to GET /properties', async () => {
    (api.get as any).mockResolvedValueOnce({ data: { total: 1, page: 1, page_size: 20, items: [] } });
    const res = await propertyService.listProperties({ city: 'Urubici', min_guests: 4 });
    expect(api.get).toHaveBeenCalledWith('/properties', {
      params: { city: 'Urubici', min_guests: 4 },
    });
    expect(res.total).toBe(1);
  });

  it('taskService toggles checklist items and updates status via PATCH /tasks', async () => {
    (api.patch as any).mockResolvedValueOnce({ data: { id: 't1', status: 'in_progress' } });
    const toggled = await taskService.toggleChecklistItem('t1', 'item1', true);
    expect(api.patch).toHaveBeenCalledWith('/tasks/t1/checklist/item1', { is_checked: true });
    expect(toggled.status).toBe('in_progress');

    (api.patch as any).mockResolvedValueOnce({ data: { id: 't1', status: 'completed' } });
    const completed = await taskService.updateTaskStatus('t1', 'completed', 'Finalizado');
    expect(api.patch).toHaveBeenCalledWith('/tasks/t1/status', {
      status: 'completed',
      completion_notes: 'Finalizado',
    });
    expect(completed.status).toBe('completed');
  });

  it('bookingService creates reservations and triggers LGPD guest anonymization', async () => {
    (api.post as any).mockResolvedValueOnce({ data: { id: 'r1', nights: 3 } });
    const created = await bookingService.createReservation({
      property_id: 'p1',
      guest_name: 'Hóspede Real',
      source: 'direct',
      check_in_date: '2026-12-01',
      check_out_date: '2026-12-04',
      guests_count: 2,
    });
    expect(api.post).toHaveBeenCalledWith('/bookings', expect.objectContaining({ guest_name: 'Hóspede Real' }));
    expect(created.nights).toBe(3);

    (api.post as any).mockResolvedValueOnce({ data: {} });
    await bookingService.anonymizeGuest('g1');
    expect(api.post).toHaveBeenCalledWith('/bookings/guests/g1/anonymize');
  });

  it('inventoryService records stock movements via POST /inventory/movements', async () => {
    (api.post as any).mockResolvedValueOnce({ data: { id: 'm1', balance_after: 12 } });
    const mov = await inventoryService.recordMovement({
      item_id: 'i1',
      movement_type: 'in',
      quantity: 5,
      reason: 'Compra mensal',
    });
    expect(api.post).toHaveBeenCalledWith('/inventory/movements', {
      item_id: 'i1',
      movement_type: 'in',
      quantity: 5,
      reason: 'Compra mensal',
    });
    expect(mov.balance_after).toBe(12);
  });

  it('financeService and dashboardService fetch real summaries', async () => {
    (api.get as any).mockResolvedValueOnce({
      data: { total_income: 2000, total_expense: 500, net_result: 1500, margin_pct: 75 },
    });
    const fin = await financeService.getSummary('p1');
    expect(api.get).toHaveBeenCalledWith('/finance/summary', { params: { property_id: 'p1' } });
    expect(fin.net_result).toBe(1500);

    (api.get as any).mockResolvedValueOnce({
      data: { role: 'owner', properties_count: 2, occupancy_pct: 80 },
    });
    const dash = await dashboardService.getSummary();
    expect(api.get).toHaveBeenCalledWith('/dashboard/summary');
    expect(dash.properties_count).toBe(2);
  });
});
