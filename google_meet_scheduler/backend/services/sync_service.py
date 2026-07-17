import asyncio
import traceback
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..database.connection import SessionLocal
from ..models.models import Meeting, User
from .calendar_service import sync_google_event_rsvps

async def start_rsvp_sync_loop():
    """
    Background worker loop that runs every 2 minutes.
    Synchronizes RSVPs for all active or upcoming scheduled meetings.
    """
    print("[SYNC SERVICE] Background RSVP Synchronizer loop initialized.")
    while True:
        try:
            # Short delay on startup, or 2 minutes wait between polling cycles
            await asyncio.sleep(120)
            
            print("[SYNC SERVICE] Executing background RSVP sync cycle...")
            db: Session = SessionLocal()
            try:
                # Retrieve upcoming scheduled meetings
                upcoming_meetings = db.query(Meeting).filter(
                    Meeting.status == "scheduled",
                    Meeting.end_time > datetime.now(timezone.utc)
                ).all()
                
                print(f"[SYNC SERVICE] Found {len(upcoming_meetings)} active meetings to synchronize.")
                
                for meeting in upcoming_meetings:
                    if not meeting.calendar_event_id:
                        continue
                    
                    # Find organizer user profile to authorize Google API calls
                    organizer = db.query(User).filter(User.email == meeting.organizer_email).first()
                    if not organizer:
                        print(f"[SYNC SERVICE] WARNING: Organizer user profile {meeting.organizer_email} not found for meeting {meeting.id}")
                        continue
                        
                    try:
                        sync_google_event_rsvps(organizer, db, meeting.calendar_event_id, meeting.id)
                    except Exception as sync_err:
                        print(f"[SYNC SERVICE] Sync failed for meeting {meeting.id}: {sync_err}")
                        
            finally:
                db.close()
                
        except asyncio.CancelledError:
            print("[SYNC SERVICE] Background RSVP synchronization loop stopped.")
            break
        except Exception as loop_err:
            print(f"[SYNC SERVICE] CRITICAL: Unexpected error in background sync loop: {loop_err}")
            traceback.print_exc()
