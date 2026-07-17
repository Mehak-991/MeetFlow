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
