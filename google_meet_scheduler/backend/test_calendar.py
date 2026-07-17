import os
import sys
from datetime import datetime, timedelta, timezone

# Add parent directory to path so imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google_meet_scheduler.backend.database.connection import SessionLocal
from google_meet_scheduler.backend.models.models import User
from google_meet_scheduler.backend.services.calendar_service import create_meet_event

def run_test():
    print("[TEST] Starting Google Calendar Email Verification Test...")
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("[TEST] ERROR: No user found in the database. Please log in first via the frontend.")
            return

        print(f"[TEST] Using user: {user.email}")
        
        event_data = {
            "title": "Automated Email Verification Test",
            "description": "This is a test event to verify if Google Calendar sends invitation emails to attendees.",
            "start_time": datetime.now(timezone.utc) + timedelta(days=1),
            "end_time": datetime.now(timezone.utc) + timedelta(days=1, hours=1),
            "timezone": "UTC",
            "attendees": [
                "missmehak755@gmail.com",
                "missmehak755@gmail.com"
            ]
        }
        
        result = create_meet_event(user, db, event_data)
        print("[TEST] SUCCESS! Event created successfully.")
        print(f"  - Event ID: {result['calendar_event_id']}")
        print(f"  - Meet Link: {result['meet_link']}")
        print(f"  - Organizer: {result['organizer_email']}")
        
    except Exception as e:
        print(f"[TEST] ERROR: Test failed with exception: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
