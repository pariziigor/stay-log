from datetime import datetime
from enum import Enum
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class TaskType(str, Enum):
    CLEANING = "cleaning"
    MAINTENANCE = "maintenance"
    INSPECTION = "inspection"
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"
    RESTOCK = "restock"
    OTHER = "other"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ChecklistItemCreateDTO(BaseModel):
    description: str = Field(..., min_length=2, max_length=255)
    is_required: bool = True


class ChecklistItemResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    description: str
    is_required: bool
    is_checked: bool
    checked_by: Optional[uuid.UUID] = None
    checked_at: Optional[datetime] = None


class ChecklistItemToggleDTO(BaseModel):
    is_checked: bool


class TaskCreateDTO(BaseModel):
    property_id: uuid.UUID
    reservation_id: Optional[uuid.UUID] = None
    task_type: TaskType
    title: str = Field(..., min_length=3, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    priority: TaskPriority = TaskPriority.MEDIUM
    due_at: datetime
    estimated_minutes: Optional[int] = Field(None, ge=1, le=1440)
    assigned_to: Optional[uuid.UUID] = None
    checklist_items: List[ChecklistItemCreateDTO] = Field(default_factory=list)


class TaskStatusUpdateDTO(BaseModel):
    status: TaskStatus
    completion_notes: Optional[str] = Field(None, max_length=2000)


class TaskResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID
    property_name: str
    reservation_id: Optional[uuid.UUID] = None
    task_type: TaskType
    title: str
    description: Optional[str] = None
    priority: TaskPriority
    status: TaskStatus
    due_at: datetime
    estimated_minutes: Optional[int] = None
    assigned_to: Optional[uuid.UUID] = None
    assignee_name: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    checklist_items: List[ChecklistItemResponseDTO]
    created_at: datetime
    updated_at: datetime
