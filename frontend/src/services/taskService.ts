import api from './api';

export type TaskType = 'cleaning' | 'maintenance' | 'inspection' | 'check_in' | 'check_out' | 'restock' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export interface ChecklistItem {
  id: string;
  position: number;
  description: string;
  is_required: boolean;
  is_checked: boolean;
  checked_by?: string | null;
  checked_at?: string | null;
}

export interface TaskItem {
  id: string;
  property_id: string;
  property_name: string;
  reservation_id?: string | null;
  task_type: TaskType;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string;
  estimated_minutes?: number | null;
  assigned_to?: string | null;
  assignee_name?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  completion_notes?: string | null;
  checklist_items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface TaskCreatePayload {
  property_id: string;
  task_type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  due_at: string;
  estimated_minutes?: number;
  assigned_to?: string;
  checklist_items: Array<{ description: string; is_required: boolean }>;
}

export const taskService = {
  async listTasks(params?: { task_type?: string; status?: string; property_id?: string }): Promise<TaskItem[]> {
    const response = await api.get<TaskItem[]>('/tasks', { params });
    return response.data;
  },

  async createTask(payload: TaskCreatePayload): Promise<TaskItem> {
    const response = await api.post<TaskItem>('/tasks', payload);
    return response.data;
  },

  async toggleChecklistItem(taskId: string, itemId: string, is_checked: boolean): Promise<TaskItem> {
    const response = await api.patch<TaskItem>(`/tasks/${taskId}/checklist/${itemId}`, { is_checked });
    return response.data;
  },

  async updateTaskStatus(taskId: string, status: TaskStatus, completion_notes?: string): Promise<TaskItem> {
    const response = await api.patch<TaskItem>(`/tasks/${taskId}/status`, { status, completion_notes });
    return response.data;
  },

  async deleteTask(taskId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}`);
  },
};
