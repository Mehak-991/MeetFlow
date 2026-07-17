import datetime
import uuid
from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey, Boolean, Text
from sqlalchemy.sql import func
from ..database.connection import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String, nullable=False)
    logo_url = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    meeting_defaults = Column(JSON, nullable=False, default={})
    recording_defaults = Column(JSON, nullable=False, default={})
    ai_defaults = Column(JSON, nullable=False, default={})
    custom_colors = Column(JSON, nullable=False, default={})
    timezone = Column(String, nullable=False, default="UTC")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    google_token_expiry = Column(DateTime, nullable=True)
    role = Column(String, nullable=False, default="Member")
    is_active = Column(Boolean, nullable=False, default=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    department = Column(String, nullable=True)
    last_active_at = Column(DateTime(timezone=True), nullable=True)

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    timezone = Column(String, nullable=False)
    meet_link = Column(String, nullable=True)
    calendar_event_id = Column(String, nullable=True)
    organizer_email = Column(String, nullable=False)
    attendees = Column(JSON, nullable=False, default=[]) # list of emails
    status = Column(String, nullable=False, default="scheduled") # scheduled, completed, cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class Participant(Base):
    __tablename__ = "participants"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=True)
    email = Column(String, nullable=False, index=True)
    avatar = Column(String, nullable=True)
    role = Column(String, nullable=False, default="guest") # host, guest
    response_status = Column(String, nullable=False, default="needsAction") # needsAction, accepted, declined, tentative
    invitation_sent = Column(Boolean, default=True, nullable=False)
    invitation_sent_at = Column(DateTime(timezone=True), server_default=func.now())
    last_synced = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    declined_at = Column(DateTime(timezone=True), nullable=True)
    tentative_at = Column(DateTime(timezone=True), nullable=True)
    sync_error = Column(String, nullable=True)
    joined_at = Column(DateTime(timezone=True), nullable=True)
    left_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class MeetingNote(Base):
    __tablename__ = "meeting_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class MeetingRecording(Base):
    __tablename__ = "meeting_recordings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String, nullable=False)
    duration = Column(Integer, nullable=True) # in seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MeetingSummary(Base):
    __tablename__ = "meeting_summaries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    summary_text = Column(Text, nullable=False)
    action_items = Column(JSON, nullable=False, default=[]) # list of dicts
    key_decisions = Column(JSON, nullable=False, default=[]) # list of strings
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_revoked = Column(Boolean, default=False, nullable=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, nullable=True) # can be null for anonymous actions
    user_email = Column(String, nullable=True)
    action = Column(String, nullable=False) # e.g. CREATE_MEETING, CANCEL_MEETING
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    target_resource = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class OrganizationInvitation(Base):
    __tablename__ = "organization_invitations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    email = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False, default="Member")
    invited_by = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Pending") # Pending, Accepted, Expired
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserNotification(Base):
    __tablename__ = "user_notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, nullable=False) # MEETING_STARTING, INVITATION_ACCEPTED, RECORDING_READY, SYSTEM
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MeetingTranscript(Base):
    __tablename__ = "meeting_transcripts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    speaker = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MeetingActionItem(Base):
    __tablename__ = "meeting_action_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    task = Column(String, nullable=False)
    owner = Column(String, nullable=True)
    deadline = Column(String, nullable=True)
    priority = Column(String, nullable=False, default="Medium") # High, Medium, Low
    status = Column(String, nullable=False, default="Pending") # Pending, Completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MeetingInsight(Base):
    __tablename__ = "meeting_insights"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    participation_score = Column(Integer, nullable=True)
    speaking_times = Column(JSON, nullable=True) # e.g. {"Host": 120, "Guest": 45}
    silent_participants = Column(JSON, nullable=True) # list of emails
    interruptions = Column(Integer, default=0, nullable=False)
    attendance_report = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AISetting(Base):
    __tablename__ = "ai_settings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    summary_style = Column(String, nullable=False, default="detailed") # bullet, detailed, executive
    transcript_language = Column(String, nullable=False, default="en")
    auto_summary = Column(Boolean, default=True, nullable=False)
    auto_email = Column(Boolean, default=True, nullable=False)
    auto_export = Column(Boolean, default=False, nullable=False)
    ai_model = Column(String, nullable=False, default="gpt-4o-mini")

class IntegrationSetting(Base):
    __tablename__ = "integration_settings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    slack_webhook = Column(String, nullable=True)
    discord_webhook = Column(String, nullable=True)
    notion_token = Column(String, nullable=True)
    notion_database_id = Column(String, nullable=True)
    jira_url = Column(String, nullable=True)
    jira_token = Column(String, nullable=True)
    jira_project = Column(String, nullable=True)
    trello_token = Column(String, nullable=True)
    trello_board_id = Column(String, nullable=True)
    github_token = Column(String, nullable=True)
    github_repo = Column(String, nullable=True)
    enabled_integrations = Column(JSON, nullable=False, default={}) # {"slack": true, "notion": false}
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WebhookConfig(Base):
    __tablename__ = "webhook_configs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    events = Column(JSON, nullable=False, default=[]) # ["meeting.created", "ai.summary.ready"]
    secret = Column(String, nullable=False, default=lambda: str(uuid.uuid4()))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    webhook_id = Column(String, ForeignKey("webhook_configs.id", ondelete="CASCADE"), nullable=False)
    event = Column(String, nullable=False)
    status_code = Column(Integer, nullable=True)
    payload = Column(Text, nullable=False)
    response_text = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key_hash = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime, nullable=True)
