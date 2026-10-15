from enum import Enum


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class InsightSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class InsightType(str, Enum):
    LOW_STOCK = "low_stock"
    OCCUPANCY_DROP = "occupancy_drop"
    OVERDUE_TASKS = "overdue_tasks"
    PRICING_OPPORTUNITY = "pricing"
    MAINTENANCE_ALERT = "maintenance_pattern"
    CASH_FLOW = "cash_flow"
