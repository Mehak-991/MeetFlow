from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    timezone: str
    attendees: List[EmailStr]

class MeetingReschedule(BaseModel):
    start_time: datetime
    end_time: datetime
    timezone: Optional[str] = None

class MeetingResponse(BaseModel):
    success: bool
    meetingId: str
    meetLink: str
    calendarEventId: str

class MeetingOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    timezone: str
    meet_link: Optional[str] = None
    calendar_event_id: Optional[str] = None
    organizer_email: str
    attendees: List[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    email: str
    name: Optional[str] = None

    class Config:
        from_attributes = True

class ParticipantOut(BaseModel):
    id: str
    meeting_id: str
    name: str
    email: str
    role: str
    joined_at: datetime
    left_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MeetingNoteCreate(BaseModel):
    content: str

class MeetingNoteOut(BaseModel):
    id: str
    meeting_id: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MeetingSummaryOut(BaseModel):
    id: str
    meeting_id: str
    summary_text: str
    action_items: List[dict]
    key_decisions: List[str]
    created_at: datetime

    class Config:
        from_attributes = True
