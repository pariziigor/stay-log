export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type InsightSeverity = 'info' | 'warning' | 'critical' | 'opportunity';

export type InsightType =
  | 'low_occupancy'
  | 'high_demand'
  | 'stock_shortage'
  | 'maintenance_alert'
  | 'cleaning_delayed'
  | 'pricing_opportunity'
  | 'guest_review_sentiment'
  | 'cash_flow_warning';

export interface ChatMessageRequest {
  content: string;
  conversation_id?: string;
  property_id?: string;
}

export interface ChatMessageResponse {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  suggested_actions: string[];
  metrics_snapshot?: Record<string, any>;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  property_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AIInsight {
  id: string;
  insight_type: InsightType;
  severity: InsightSeverity;
  title: string;
  content: string;
  data: Record<string, any>;
  created_at: string;
}
