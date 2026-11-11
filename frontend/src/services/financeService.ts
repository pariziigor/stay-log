import api from './api';

export type TransactionType = 'income' | 'expense';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'cash' | 'platform_payout' | 'other';

export interface FinancialCategory {
  id: number;
  owner_id?: string | null;
  name: string;
  type: TransactionType;
  is_active: boolean;
}

export interface FinancialTransaction {
  id: string;
  property_id: string;
  property_name: string;
  category_id: number;
  category_name: string;
  type: TransactionType;
  amount: string | number;
  description: string;
  transaction_date: string;
  due_date?: string | null;
  paid_date?: string | null;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod | null;
  reservation_id?: string | null;
  created_at: string;
}

export interface CashFlowSummary {
  total_income: string | number;
  total_expense: string | number;
  net_result: string | number;
  margin_pct: number;
  pending_income: string | number;
  pending_expense: string | number;
  transactions_count: number;
}

export const financeService = {
  async listCategories(): Promise<FinancialCategory[]> {
    const response = await api.get<FinancialCategory[]>('/finance/categories');
    return response.data;
  },

  async createCategory(payload: { name: string; type: TransactionType }): Promise<FinancialCategory> {
    const response = await api.post<FinancialCategory>('/finance/categories', payload);
    return response.data;
  },

  async listTransactions(params?: {
    property_id?: string;
    type?: TransactionType;
    payment_status?: PaymentStatus;
  }): Promise<FinancialTransaction[]> {
    const response = await api.get<FinancialTransaction[]>('/finance/transactions', { params });
    return response.data;
  },

  async createTransaction(payload: {
    property_id: string;
    category_id: number;
    type: TransactionType;
    amount: number;
    description: string;
    transaction_date: string;
    payment_status?: PaymentStatus;
    payment_method?: PaymentMethod;
  }): Promise<FinancialTransaction> {
    const response = await api.post<FinancialTransaction>('/finance/transactions', payload);
    return response.data;
  },

  async getSummary(property_id?: string): Promise<CashFlowSummary> {
    const response = await api.get<CashFlowSummary>('/finance/summary', {
      params: property_id ? { property_id } : undefined,
    });
    return response.data;
  },
};
