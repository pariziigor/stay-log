import api from './api';

export type StockMovementType = 'in' | 'out' | 'adjustment';

export interface InventoryItem {
  id: string;
  property_id: string;
  property_name: string;
  name: string;
  category: string;
  unit: string;
  current_quantity: string | number;
  minimum_quantity: string | number;
  is_low_stock: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  item_name: string;
  property_name: string;
  movement_type: StockMovementType;
  quantity: string | number;
  balance_after: string | number;
  unit_cost?: string | number | null;
  reason?: string | null;
  occurred_at: string;
}

export const inventoryService = {
  async listItems(params?: { property_id?: string; low_stock_only?: boolean }): Promise<InventoryItem[]> {
    const response = await api.get<InventoryItem[]>('/inventory/items', { params });
    return response.data;
  },

  async createItem(payload: {
    property_id: string;
    name: string;
    category: string;
    unit: string;
    initial_quantity: number;
    minimum_quantity: number;
  }): Promise<InventoryItem> {
    const response = await api.post<InventoryItem>('/inventory/items', payload);
    return response.data;
  },

  async recordMovement(payload: {
    item_id: string;
    movement_type: StockMovementType;
    quantity: number;
    unit_cost?: number;
    reason?: string;
  }): Promise<InventoryMovement> {
    const response = await api.post<InventoryMovement>('/inventory/movements', payload);
    return response.data;
  },

  async listMovements(params?: { item_id?: string; property_id?: string }): Promise<InventoryMovement[]> {
    const response = await api.get<InventoryMovement[]>('/inventory/movements', { params });
    return response.data;
  },
};
