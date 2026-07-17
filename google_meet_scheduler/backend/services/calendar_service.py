import os
from datetime import datetime, timezone
import google.oauth2.credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from ..models.models import User

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

def refresh_user_tokens(user: User, db):
    """
    Checks if the user's access token is expired and refreshes it.
    Saves the new access token and expiry to the database.
    """
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    if not user.google_token_expiry or user.google_token_expiry <= now_utc:
        if not user.google_refresh_token:
            raise Exception("No refresh token available. Please re-authenticate.")

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
        except Exception as e:
            print(f"Error refreshing Google OAuth token for user {user.email}: {e}")
            raise Exception("Failed to refresh Google OAuth token. Please reconnect your account.")
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
        'attendees': [{'email': email} for email in event_data['attendees']],
        'conferenceData': {
            'createRequest': {
                'requestId': f"meet-{int(datetime.now(timezone.utc).timestamp())}",
                'conferenceSolutionKey': {
                    'type': 'hangoutsMeet'
                }
            }
        }
    }
    
    result = service.events().insert(
        calendarId='primary',
        body=event_body,
        conferenceDataVersion=1,
        sendUpdates='all'
    ).execute()
    
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
    
    event = service.events().get(calendarId='primary', eventId=event_id).execute()
    
    event['start'] = {
        'dateTime': start_time.isoformat(),
        'timeZone': timezone_str
    }
    event['end'] = {
        'dateTime': end_time.isoformat(),
        'timeZone': timezone_str
    }
    
    result = service.events().update(
        calendarId='primary',
        eventId=event_id,
        body=event,
        sendUpdates='all'
    ).execute()
    
    return result

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
    
    service.events().delete(
        calendarId='primary',
        eventId=event_id,
        sendUpdates='all'
    ).execute()
