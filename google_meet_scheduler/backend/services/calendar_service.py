from fastapi import HTTPException
import os
import json
from datetime import datetime, timezone
import google.oauth2.credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from ..models.models import User

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

def refresh_user_tokens(user: User, db):
    """
    Checks if the user's access token is expired and refreshes it.
    Saves the new access token and expiry to the database.
    """
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    
    print(f"[AUDIT] Checking tokens for user {user.email}")
    print(f"  - Access Token Exists: {bool(user.google_access_token)}")
    print(f"  - Token Expiry: {user.google_token_expiry}")
    print(f"  - Current UTC Time: {now_utc}")
    
    if not user.google_token_expiry or user.google_token_expiry <= now_utc:
        if not user.google_refresh_token:
            print("[AUDIT] ERROR: No refresh token found in database.")
            raise Exception("No refresh token available. Please reconnect your Google Account and grant all permissions.")

        print("[AUDIT] Access token expired or expiring. Refreshing...")
        creds = google.oauth2.credentials.Credentials(
            token=user.google_access_token,
            refresh_token=user.google_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET
        )
        try:
            creds.refresh(Request())
            user.google_access_token = creds.token
            if creds.expiry:
                user.google_token_expiry = creds.expiry
            db.commit()
            db.refresh(user)
            print(f"[AUDIT] Token refreshed successfully. New expiry: {user.google_token_expiry}")
        except Exception as e:
            print(f"[AUDIT] ERROR: Failed to refresh Google OAuth token: {e}")
            raise Exception("Failed to refresh Google OAuth token. Please reconnect your account.")
    else:
        print("[AUDIT] Access token is still valid.")
    return user.google_access_token

def create_meet_event(user: User, db, event_data: dict):
    """
    Creates a Google Calendar event with a Google Meet link.
    """
    access_token = refresh_user_tokens(user, db)
    
    creds = google.oauth2.credentials.Credentials(
        token=access_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET
    )
    
    service = build("calendar", "v3", credentials=creds)
    
    # Structure attendees correctly: List of dicts, ensuring emails are non-empty strings
    attendees_list = []
    for email in event_data.get('attendees', []):
        if email and isinstance(email, str) and "@" in email:
            attendees_list.append({'email': email.strip()})
            
    print(f"[AUDIT] Formatted Attendees: {attendees_list}")

    event_body = {
        'summary': event_data['title'],
        'description': event_data.get('description', ''),
        'start': {
            'dateTime': event_data['start_time'].isoformat(),
            'timeZone': event_data['timezone'],
        },
        'end': {
            'dateTime': event_data['end_time'].isoformat(),
            'timeZone': event_data['timezone'],
        },
        'attendees': attendees_list,
        'conferenceData': {
            'createRequest': {
                'requestId': f"meet-{int(datetime.now(timezone.utc).timestamp())}",
                'conferenceSolutionKey': {
                    'type': 'hangoutsMeet'
                }
            }
        }
    }
    
    print(f"[AUDIT] Event Payload sent to Google Calendar API:")
    print(json.dumps(event_body, indent=2))

    try:
        # We call insert with conferenceDataVersion=1 and sendUpdates='all' to force emails
        request = service.events().insert(
            calendarId='primary',
            body=event_body,
            conferenceDataVersion=1,
            sendUpdates='all'
        )
        
        print(f"[AUDIT] Executing Google Calendar API call (sendUpdates=all)...")
        result = request.execute()
        
        print(f"[AUDIT] Google Calendar API Response:")
        print(json.dumps(result, indent=2))

        meet_link = ""
        conf_data = result.get('conferenceData', {})
        entry_points = conf_data.get('entryPoints', [])
        for entry in entry_points:
            if entry.get('entryPointType') == 'video':
                meet_link = entry.get('uri')
                break
                
        return {
            'calendar_event_id': result.get('id'),
            'meet_link': meet_link,
            'organizer_email': result.get('organizer', {}).get('email', user.email)
        }
    except HttpError as error:
        print(f"[AUDIT] GOOGLE CALENDAR API ERROR: Code {error.resp.status}")
        print(f"Response: {error.content.decode('utf-8')}")
        
        # Analyze error cause
        if error.resp.status == 403:
            raise HTTPException(status_code=403, detail="Insufficient Permissions. Please re-login and grant Calendar access.")
        elif error.resp.status == 400:
            raise HTTPException(status_code=400, detail=f"Bad Request: {error.content.decode('utf-8')}")
        else:
            raise HTTPException(status_code=500, detail=f"Google API Error: {error.reason}")

def update_meet_event(user: User, db, event_id: str, start_time: datetime, end_time: datetime, timezone_str: str):
    """
    Updates the start/end time of an existing Google Calendar event.
    """
    access_token = refresh_user_tokens(user, db)
    
    creds = google.oauth2.credentials.Credentials(
        token=access_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET
    )
    
    service = build("calendar", "v3", credentials=creds)
    
    try:
        event = service.events().get(calendarId='primary', eventId=event_id).execute()
        
        event['start'] = {
            'dateTime': start_time.isoformat(),
            'timeZone': timezone_str
        }
        event['end'] = {
            'dateTime': end_time.isoformat(),
            'timeZone': timezone_str
        }
        
        print(f"[AUDIT] Updating event {event_id} (sendUpdates=all)...")
        result = service.events().update(
            calendarId='primary',
            eventId=event_id,
            body=event,
            sendUpdates='all'
        ).execute()
        
        print(f"[AUDIT] Update response: {json.dumps(result, indent=2)}")
        return result
    except HttpError as error:
        print(f"[AUDIT] UPDATE GOOGLE CALENDAR API ERROR: Code {error.resp.status}")
        print(f"Response: {error.content.decode('utf-8')}")
        raise error

def delete_meet_event(user: User, db, event_id: str):
    """
    Deletes an event from Google Calendar.
    """
    access_token = refresh_user_tokens(user, db)
    
    creds = google.oauth2.credentials.Credentials(
        token=access_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET
    )
    
    service = build("calendar", "v3", credentials=creds)
    
    try:
        print(f"[AUDIT] Deleting event {event_id} (sendUpdates=all)...")
        service.events().delete(
            calendarId='primary',
            eventId=event_id,
            sendUpdates='all'
        ).execute()
        print(f"[AUDIT] Deletion successful.")
    except HttpError as error:
        print(f"[AUDIT] DELETE GOOGLE CALENDAR API ERROR: Code {error.resp.status}")
        print(f"Response: {error.content.decode('utf-8')}")
        raise error

def sync_google_event_rsvps(user: User, db, event_id: str, meeting_id: str):
    """
    Fetches the latest event details from Google Calendar and updates local attendee RSVPs in database.
    """
    access_token = refresh_user_tokens(user, db)
    
    creds = google.oauth2.credentials.Credentials(
        token=access_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET
    )
    
    service = build("calendar", "v3", credentials=creds)
    
    try:
        print(f"[AUDIT] Syncing RSVPs for Google Event {event_id} (Meeting {meeting_id})...")
        event = service.events().get(calendarId='primary', eventId=event_id).execute()
        
        attendees = event.get('attendees', [])
        print(f"[AUDIT] Found {len(attendees)} attendees on Google Calendar.")
        
        from ..models.models import Participant
        
        changed = False
        synced_emails = []
        now_utc = datetime.now(timezone.utc)
        
        for att in attendees:
            email = att.get('email')
            if not email:
                continue
            
            response_status = att.get('responseStatus', 'needsAction')
            display_name = att.get('displayName', '')
            
            synced_emails.append(email.lower())
            
            participant = db.query(Participant).filter(
                Participant.meeting_id == meeting_id,
                Participant.email.ilike(email)
            ).first()
            
            if not participant:
                # Create guest
                participant = Participant(
                    meeting_id=meeting_id,
                    email=email.lower(),
                    name=display_name or email.split("@")[0],
                    role="guest",
                    response_status=response_status,
                    invitation_sent=True,
                    invitation_sent_at=now_utc,
                    last_synced=now_utc,
                    sync_error=None
                )
                
                # Apply initial timestamps
                if response_status == 'accepted':
                    participant.accepted_at = now_utc
                elif response_status == 'declined':
                    participant.declined_at = now_utc
                elif response_status == 'tentative':
                    participant.tentative_at = now_utc
                    
                db.add(participant)
                changed = True
            else:
                # Sync updates
                participant.sync_error = None
                participant.last_synced = now_utc
                
                if participant.response_status != response_status:
                    print(f"[AUDIT] Participant {email} status changed: {participant.response_status} -> {response_status}")
                    participant.response_status = response_status
                    
                    if response_status == 'accepted':
                        participant.accepted_at = now_utc
                    elif response_status == 'declined':
                        participant.declined_at = now_utc
                    elif response_status == 'tentative':
                        participant.tentative_at = now_utc
                        
                    changed = True
                
                if display_name and participant.name != display_name:
                    participant.name = display_name
                    changed = True
                    
        db.commit()
        print(f"[AUDIT] RSVP sync completed successfully for meeting {meeting_id}.")
        
        # Broadcast via WebSocket if any status updated
        if changed:
            try:
                from ..routers.websockets import manager
                import asyncio
                asyncio.create_task(manager.broadcast_to_meeting(meeting_id, {
                    "type": "RSVP_UPDATE",
                    "meeting_id": meeting_id
                }))
                print(f"[AUDIT] Live RSVP WebSocket broadcast dispatched.")
            except Exception as ws_err:
                print(f"[AUDIT] Failed to schedule WebSocket broadcast: {ws_err}")
                
        return True
    except HttpError as error:
        err_msg = error.content.decode('utf-8')
        print(f"[AUDIT] RSVP SYNC ERROR: Code {error.resp.status}")
        print(f"Response: {err_msg}")
        
        # Save sync error inside Participant records
        try:
            from ..models.models import Participant
            db.query(Participant).filter(Participant.meeting_id == meeting_id).update(
                {"sync_error": f"Google API Error {error.resp.status}: {err_msg}"},
                synchronize_session=False
            )
            db.commit()
        except Exception as db_err:
            print(f"Failed to record sync error in DB: {db_err}")
            
        return False
    except Exception as e:
        print(f"[AUDIT] RSVP SYNC unexpected error: {e}")
        try:
            from ..models.models import Participant
            db.query(Participant).filter(Participant.meeting_id == meeting_id).update(
                {"sync_error": str(e)},
                synchronize_session=False
            )
            db.commit()
        except Exception:
            pass
        return False
