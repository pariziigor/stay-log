import api from './api';

export interface DashboardSummary {
  role: 'admin' | 'owner' | 'employee';
  properties_count: number;
  occupancy_pct: number;
  next_month_occupancy_pct: number;
  active_reservations_count: number;
  upcoming_check_ins_today: number;
  upcoming_check_outs_today: number;
  gross_revenue: number;
  total_expenses: number;
  net_profit: number;
  net_margin_pct: number;
  pending_tasks_count: number;
  completed_tasks_count: number;
  low_stock_items_count: number;
  low_stock_alerts: Array<{
    property_name: string;
    item_name: string;
    category: string;
    current_quantity: number;
    minimum_quantity: number;
    shortage: number;
    unit: string;
  }>;
  upcoming_tasks: Array<{
    id: string;
    title: string;
    property_name: string;
    task_type: string;
    status: string;
    priority: string;
    due_at: string;
    checklist_total: number;
    checklist_done: number;
  }>;
  users_summary?: {
    total_users: number;
    owners_count: number;
    employees_count: number;
    admins_count: number;
  };
}

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const response = await api.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },
};
