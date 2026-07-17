from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from ..database.connection import get_db
from ..models.models import Meeting, User, Participant, MeetingNote, MeetingSummary
from ..schemas.schemas import MeetingCreate, MeetingReschedule, MeetingResponse, MeetingOut, MeetingNoteCreate
from ..utils.auth import get_current_user
from ..services.calendar_service import create_meet_event, update_meet_event, delete_meet_event
from .websockets import manager

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

@router.post("/create", response_model=MeetingResponse)
def create_meeting(body: MeetingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Validate times
    if body.end_time <= body.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )
        
    duration = (body.end_time - body.start_time).total_seconds() / 60
    if duration < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting duration must be at least 5 minutes"
        )

    # 2. Check if user is connected to Google Calendar
    if not current_user.google_access_token or not current_user.google_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not connected to Google Calendar. Please authenticate first."
        )

    # 3. Create Google Calendar Event and Meet Link
    try:
        event_data = {
            "title": body.title,
            "description": body.description,
            "start_time": body.start_time,
            "end_time": body.end_time,
            "timezone": body.timezone,
            "attendees": body.attendees
        }
        res_cal = create_meet_event(current_user, db, event_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google Calendar integration error: {str(e)}"
        )

    # 4. Save to Database
    meeting = Meeting(
        title=body.title,
        description=body.description,
        start_time=body.start_time,
        end_time=body.end_time,
        timezone=body.timezone,
        meet_link=res_cal["meet_link"],
        calendar_event_id=res_cal["calendar_event_id"],
        organizer_email=res_cal["organizer_email"],
        attendees=body.attendees,
        status="scheduled"
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return {
        "success": True,
        "meetingId": meeting.id,
        "meetLink": meeting.meet_link,
        "calendarEventId": meeting.calendar_event_id
    }

@router.get("", response_model=dict)
def list_meetings(
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Meeting).filter(Meeting.organizer_email == current_user.email)
    
    if status_filter:
        query = query.filter(Meeting.status == status_filter)
    if search:
        query = query.filter(
            (Meeting.title.ilike(f"%{search}%")) | 
            (Meeting.description.ilike(f"%{search}%"))
        )
        
    total = query.count()
    meetings = query.order_by(Meeting.start_time.asc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "meetings": [MeetingOut.model_validate(m) for m in meetings],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@router.put("/{meeting_id}/reschedule")
def reschedule_meeting(
    meeting_id: str,
    body: MeetingReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch meeting
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
        
    if body.end_time <= body.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    # 2. Reschedule on Google Calendar
    if meeting.calendar_event_id:
        try:
            tz = body.timezone or meeting.timezone
            update_meet_event(current_user, db, meeting.calendar_event_id, body.start_time, body.end_time, tz)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Google Calendar reschedule failed: {str(e)}"
            )

    # 3. Update Database
    meeting.start_time = body.start_time
    meeting.end_time = body.end_time
    if body.timezone:
        meeting.timezone = body.timezone
    meeting.status = "scheduled"  # Re-enable if it was cancelled
    db.commit()
    db.refresh(meeting)

    return {"success": True, "message": "Meeting rescheduled successfully"}

@router.delete("/{meeting_id}")
def cancel_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch meeting
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )

    # 2. Delete on Google Calendar
    if meeting.calendar_event_id and meeting.status != "cancelled":
        try:
            delete_meet_event(current_user, db, meeting.calendar_event_id)
        except Exception as e:
            # Continue to cancel locally even if calendar deletion fails (e.g. if event was already deleted)
            print(f"Failed to delete Google Calendar event: {e}")

    # 3. Update status in Database
    meeting.status = "cancelled"
    db.commit()

    return {"success": True, "message": "Meeting cancelled successfully"}

@router.get("/{meeting_id}")
def get_meeting_details(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch meeting
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )

    # 2. Get participants, notes, summaries
    participants = db.query(Participant).filter(Participant.meeting_id == meeting_id).all()
    notes = db.query(MeetingNote).filter(MeetingNote.meeting_id == meeting_id).order_by(MeetingNote.created_at.desc()).all()
    summary = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting_id).order_by(MeetingSummary.created_at.desc()).first()

    return {
        "meeting": MeetingOut.model_validate(meeting),
        "participants": [
            {"id": p.id, "name": p.name, "email": p.email, "role": p.role, "joined_at": p.joined_at, "left_at": p.left_at}
            for p in participants
        ],
        "notes": [
            {"id": n.id, "content": n.content, "created_at": n.created_at}
            for n in notes
        ],
        "summary": {
            "summary_text": summary.summary_text,
            "action_items": summary.action_items,
            "key_decisions": summary.key_decisions,
            "created_at": summary.created_at
        } if summary else None
    }

@router.post("/{meeting_id}/notes")
def add_meeting_note(
    meeting_id: str,
    body: MeetingNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )

    note = MeetingNote(
        meeting_id=meeting_id,
        content=body.content
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return {"success": True, "note": {"id": note.id, "content": note.content, "created_at": note.created_at}}

@router.post("/{meeting_id}/join")
async def join_meeting_sim(
    meeting_id: str,
    name: str,
    email: str,
    db: Session = Depends(get_db)
):
    # Verify meeting exists
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participant = Participant(
        meeting_id=meeting_id,
        name=name,
        email=email,
        role="guest"
    )
    db.add(participant)
    db.commit()

    # Broadcast to websocket
    await manager.broadcast_to_meeting(meeting_id, {
        "type": "JOIN",
        "name": name,
        "email": email,
        "joined_at": datetime.now(timezone.utc).isoformat()
    })

    return {"success": True}

@router.post("/{meeting_id}/leave")
async def leave_meeting_sim(
    meeting_id: str,
    email: str,
    db: Session = Depends(get_db)
):
    participant = db.query(Participant).filter(
        Participant.meeting_id == meeting_id,
        Participant.email == email,
        Participant.left_at.is_(None)
    ).first()

    if participant:
        participant.left_at = datetime.now(timezone.utc)
        db.commit()

    await manager.broadcast_to_meeting(meeting_id, {
        "type": "LEAVE",
        "email": email,
        "left_at": datetime.now(timezone.utc).isoformat()
    })

    return {"success": True}
