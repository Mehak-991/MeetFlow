import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Add parent directory to path so imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google_meet_scheduler.backend.database.connection import SessionLocal
from google_meet_scheduler.backend.models.models import User
from google_meet_scheduler.backend.services.calendar_service import (
    create_meet_event,
    update_meet_event,
    delete_meet_event,
    sync_google_event_rsvps
)

def run_test():
    print("[INTEGRATION TEST] Starting Google Calendar Lifecycle Verification Test...")
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("[TEST] ERROR: No user found in the database. Please log in first via the frontend.")
            return

        print(f"[TEST] Authenticated User: {user.email}")
        
        # 1. CREATE MEETING (PHASE 1)
        print("\n=== STEP 1: Creating Google Calendar Event (sendUpdates='all') ===")
        event_data = {
            "title": "E2E MeetFlow Test Meeting",
            "description": "Verification of automated email invitation dispatch and Meet link generation.",
            "start_time": datetime.now(timezone.utc) + timedelta(days=1),
            "end_time": datetime.now(timezone.utc) + timedelta(days=1, hours=1),
            "timezone": "UTC",
            "attendees": ["missmehak755@gmail.com"]
        }
        
        result = create_meet_event(user, db, event_data)
        event_id = result['calendar_event_id']
        print(f"[TEST] Event Created successfully!")
        print(f"  - Event ID: {event_id}")
        print(f"  - Google Meet URL: {result['meet_link']}")
        print(f"  - Organizer: {result['organizer_email']}")
        
        # Give Google API 2 seconds cooldown
        time.sleep(2)

        # 2. ADD ATTENDEE (PHASE 2)
        print("\n=== STEP 2: Inviting an Additional Attendee ===")
        updated_attendees = ["missmehak755@gmail.com", "missmehak755@gmail.com"] # can add more
        update_result = update_meet_event(
            user=user,
            db=db,
            event_id=event_id,
            start_time=event_data["start_time"],
            end_time=event_data["end_time"],
            timezone_str=event_data["timezone"],
            attendees=updated_attendees      
        )
        print("[TEST] Attendee list updated successfully on Google Calendar.")

        time.sleep(2)

        # 3. SYNC RSVPS (PHASE 4)
        print("\n=== STEP 3: Syncing RSVP States from Google ===")
        sync_result = sync_google_event_rsvps(user, db, event_id, "test-meeting-id")
        print(f"[TEST] Sync RSVPs status: {sync_result}")

        time.sleep(2)

        # 4. RESCHEDULE EVENT (PHASE 8)
        print("\n=== STEP 4: Rescheduling Meeting Time Slot ===")
        new_start = event_data["start_time"] + timedelta(hours=2)
        new_end = event_data["end_time"] + timedelta(hours=2)
        reschedule_result = update_meet_event(
            user=user,
            db=db,
            event_id=event_id,
            start_time=new_start,
            end_time=new_end,
            timezone_str=event_data["timezone"],
            attendees=updated_attendees 
        )
        print("[TEST] Meeting rescheduled successfully on Google Calendar (update notification sent).")

        time.sleep(2)

        # 5. REMOVE ATTENDEE & CANCEL MEETING (PHASE 9)
        print("\n=== STEP 5: Cancelling Meeting / Deleting Google Event ===")
        delete_meet_event(user, db, event_id)
        print("[TEST] Event cancelled and deleted successfully (cancellation notification sent).")

        print("\n[INTEGRATION TEST] ALL STEPS PASSED SUCCESSFULLY!")

    except Exception as e:
        print(f"[TEST] ERROR: Integration test encountered exception: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
