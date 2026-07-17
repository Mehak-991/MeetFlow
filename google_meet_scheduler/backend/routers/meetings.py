from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr

from ..database.connection import get_db
from ..models.models import Meeting, User, Participant, MeetingNote, MeetingSummary
from ..schemas.schemas import MeetingCreate, MeetingReschedule, MeetingResponse, MeetingOut, MeetingNoteCreate, AttendeesBulkRequest
from ..utils.auth import get_current_user
from ..services.calendar_service import create_meet_event, update_meet_event, delete_meet_event, sync_google_event_rsvps
from .websockets import manager

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

class ResendInvitationRequest(BaseModel):
    email: str

class AttendeeAddRequest(BaseModel):
    email: str

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

    # Save initial attendees as participants in database
    for attendee_email in body.attendees:
        p = Participant(
            meeting_id=meeting.id,
            email=attendee_email.strip().lower(),
            role="guest",
            response_status="needsAction",
            invitation_sent=True,
            invitation_sent_at=datetime.now(timezone.utc)
        )
        db.add(p)
    db.commit()

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
    
    formatted_meetings = []
    for m in meetings:
        participants = db.query(Participant).filter(Participant.meeting_id == m.id).all()
        accepted = sum(1 for p in participants if p.response_status == 'accepted')
        declined = sum(1 for p in participants if p.response_status == 'declined')
        tentative = sum(1 for p in participants if p.response_status == 'tentative')
        pending = sum(1 for p in participants if p.response_status in ('needsAction', None))
        
        m_out = MeetingOut.model_validate(m)
        m_out.rsvp_stats = {
            "accepted": accepted,
            "declined": declined,
            "tentative": tentative,
            "pending": pending
        }
        formatted_meetings.append(m_out)
        
    return {
        "meetings": formatted_meetings,
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
            update_meet_event(
                current_user,
                db,
                meeting.calendar_event_id,
                body.start_time,
                body.end_time,
                tz,
                attendees=meeting.attendees
            )
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

    # Auto-sync RSVPs from Google Calendar first if connected
    if meeting.calendar_event_id:
        try:
            sync_google_event_rsvps(current_user, db, meeting.calendar_event_id, meeting.id)
        except Exception as e:
            print(f"Failed to auto-sync RSVPs: {e}")

    # 2. Get participants, notes, summaries
    participants = db.query(Participant).filter(Participant.meeting_id == meeting_id).all()
    notes = db.query(MeetingNote).filter(MeetingNote.meeting_id == meeting_id).order_by(MeetingNote.created_at.desc()).all()
    summary = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting_id).order_by(MeetingSummary.created_at.desc()).first()

    accepted = sum(1 for p in participants if p.response_status == 'accepted')
    declined = sum(1 for p in participants if p.response_status == 'declined')
    tentative = sum(1 for p in participants if p.response_status == 'tentative')
    pending = sum(1 for p in participants if p.response_status in ('needsAction', None))
    
    m_out = MeetingOut.model_validate(meeting)
    m_out.rsvp_stats = {
        "accepted": accepted,
        "declined": declined,
        "tentative": tentative,
        "pending": pending
    }

    return {
        "meeting": m_out,
        "participants": [
            {
                "id": p.id,
                "name": p.name,
                "email": p.email,
                "role": p.role,
                "response_status": p.response_status,
                "invitation_sent": p.invitation_sent,
                "invitation_sent_at": p.invitation_sent_at,
                "joined_at": p.joined_at,
                "left_at": p.left_at
            }
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

@router.post("/{meeting_id}/attendees")
def add_meeting_attendees(
    meeting_id: str,
    body: AttendeesBulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Clean and filter emails
    emails_to_add = [e.strip().lower() for e in body.emails if e.strip() and "@" in e]
    if not emails_to_add:
        raise HTTPException(status_code=400, detail="No valid email addresses provided")

    # Reject duplicates in request
    emails_to_add = list(set(emails_to_add))
    
    # Filter out already invited emails
    new_emails = [e for e in emails_to_add if e not in meeting.attendees]
    if not new_emails:
        return {"success": True, "message": "All attendees are already invited", "attendees": meeting.attendees}

    print(f"[AUDIT] Adding new attendees for meeting {meeting_id}: {new_emails}")
    print(f"  - Old list: {meeting.attendees}")

    # Merge lists
    updated_attendees = list(meeting.attendees) + new_emails
    print(f"  - New list: {updated_attendees}")

    # 1. Update on Google Calendar
    if meeting.calendar_event_id:
        try:
            update_meet_event(
                current_user,
                db,
                meeting.calendar_event_id,
                meeting.start_time,
                meeting.end_time,
                meeting.timezone,
                attendees=updated_attendees
            )
        except Exception as e:
            print(f"[AUDIT] ERROR: Google Calendar sync failed during bulk add: {e}")
            raise HTTPException(status_code=500, detail=f"Google Calendar update failed: {str(e)}")

    # 2. Add Participant records in DB
    for email in new_emails:
        display_name = email.split("@")[0]
        participant = Participant(
            meeting_id=meeting_id,
            email=email,
            name=display_name,
            role="guest",
            response_status="needsAction",
            invitation_sent=True,
            invitation_sent_at=datetime.now(timezone.utc)
        )
        db.add(participant)

    # 3. Save Meeting record
    meeting.attendees = updated_attendees
    db.commit()

    print(f"[AUDIT] Successfully added new attendees to DB and Google Calendar.")
    return {"success": True, "message": f"Successfully invited {len(new_emails)} new attendee(s)", "attendees": updated_attendees}

@router.delete("/{meeting_id}/attendees")
def remove_meeting_attendees(
    meeting_id: str,
    body: AttendeesBulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    emails_to_remove = {e.strip().lower() for e in body.emails if e.strip()}
    if not emails_to_remove:
        raise HTTPException(status_code=400, detail="No emails provided for removal")

    print(f"[AUDIT] Removing attendees for meeting {meeting_id}: {emails_to_remove}")
    print(f"  - Old list: {meeting.attendees}")

    # Clean list
    updated_attendees = [e for e in meeting.attendees if e.lower() not in emails_to_remove]
    print(f"  - New list: {updated_attendees}")

    # 1. Update on Google Calendar
    if meeting.calendar_event_id:
        try:
            update_meet_event(
                current_user,
                db,
                meeting.calendar_event_id,
                meeting.start_time,
                meeting.end_time,
                meeting.timezone,
                attendees=updated_attendees
            )
        except Exception as e:
            print(f"[AUDIT] ERROR: Google Calendar sync failed during bulk remove: {e}")
            raise HTTPException(status_code=500, detail=f"Google Calendar update failed: {str(e)}")

    # 2. Delete Participant records from DB
    db.query(Participant).filter(
        Participant.meeting_id == meeting_id,
        Participant.email.in_(list(emails_to_remove))
    ).delete(synchronize_session=False)

    # 3. Save Meeting record
    meeting.attendees = updated_attendees
    db.commit()

    print(f"[AUDIT] Successfully removed attendees from DB and Google Calendar.")
    return {"success": True, "message": f"Successfully removed {len(emails_to_remove)} attendee(s)", "attendees": updated_attendees}

@router.put("/{meeting_id}/attendees")
def replace_meeting_attendees(
    meeting_id: str,
    body: AttendeesBulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    new_attendees = list(set([e.strip().lower() for e in body.emails if e.strip() and "@" in e]))
    
    print(f"[AUDIT] Replacing attendees for meeting {meeting_id}:")
    print(f"  - Old list: {meeting.attendees}")
    print(f"  - Target list: {new_attendees}")

    # 1. Update Google Calendar
    if meeting.calendar_event_id:
        try:
            update_meet_event(
                current_user,
                db,
                meeting.calendar_event_id,
                meeting.start_time,
                meeting.end_time,
                meeting.timezone,
                attendees=new_attendees
            )
        except Exception as e:
            print(f"[AUDIT] ERROR: Google Calendar sync failed during replacement: {e}")
            raise HTTPException(status_code=500, detail=f"Google Calendar update failed: {str(e)}")

    # 2. Calculate additions and deletions
    old_set = set(meeting.attendees)
    new_set = set(new_attendees)
    
    to_add = new_set - old_set
    to_remove = old_set - new_set

    # Remove deleted participants
    if to_remove:
        db.query(Participant).filter(
            Participant.meeting_id == meeting_id,
            Participant.email.in_(list(to_remove))
        ).delete(synchronize_session=False)

    # Insert new participants
    for email in to_add:
        display_name = email.split("@")[0]
        participant = Participant(
            meeting_id=meeting_id,
            email=email,
            name=display_name,
            role="guest",
            response_status="needsAction",
            invitation_sent=True,
            invitation_sent_at=datetime.now(timezone.utc)
        )
        db.add(participant)

    # 3. Update meeting list
    meeting.attendees = new_attendees
    db.commit()

    print(f"[AUDIT] Attendee replacement complete.")
    return {"success": True, "message": "Attendees list replaced successfully", "attendees": new_attendees}

@router.post("/{meeting_id}/resend-invitation")
def resend_meeting_invitation(
    meeting_id: str,
    body: ResendInvitationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    if not meeting.calendar_event_id:
        raise HTTPException(status_code=400, detail="Meeting is not associated with Google Calendar")

    try:
        update_meet_event(
            current_user,
            db,
            meeting.calendar_event_id,
            meeting.start_time,
            meeting.end_time,
            meeting.timezone,
            attendees=meeting.attendees
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resend invitation: {str(e)}")

    return {"success": True, "message": f"Invitation email resent to {body.email}"}

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

    # Find existing or create new
    participant = db.query(Participant).filter(
        Participant.meeting_id == meeting_id,
        Participant.email.ilike(email)
    ).first()
    
    if not participant:
        participant = Participant(
            meeting_id=meeting_id,
            name=name,
            email=email,
            role="guest",
            joined_at=datetime.now(timezone.utc)
        )
        db.add(participant)
    else:
        participant.joined_at = datetime.now(timezone.utc)
        participant.left_at = None
        if name:
            participant.name = name

    db.commit()

    # Broadcast to websocket
    await manager.broadcast_to_meeting(meeting_id, {
        "type": "JOIN",
        "name": name or email,
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

@router.get("/{meeting_id}/participants")
def get_meeting_participants(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participants = db.query(Participant).filter(Participant.meeting_id == meeting_id).all()
    
    result = []
    for p in participants:
        is_organizer = (p.email.lower() == meeting.organizer_email.lower()) or (p.role == "host")
        result.append({
            "email": p.email,
            "display_name": p.name or p.email.split("@")[0],
            "response_status": p.response_status,
            "organizer": is_organizer,
            "avatar": p.avatar or (p.name[0].upper() if p.name else p.email[0].upper()),
            "last_synced": p.last_synced.isoformat() if p.last_synced else None
        })
        
    return {"success": True, "participants": result}
