import os
import uuid
import json
import requests
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database.connection import get_db
from ..models.models import User, Meeting, MeetingSummary, IntegrationSetting, WebhookConfig, WebhookLog, APIKey
from ..utils.auth import get_current_user

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# Schemas
class IntegrationSettingsUpdate(BaseModel):
    slack_webhook: Optional[str] = None
    discord_webhook: Optional[str] = None
    notion_token: Optional[str] = None
    notion_database_id: Optional[str] = None
    jira_url: Optional[str] = None
    jira_token: Optional[str] = None
    jira_project: Optional[str] = None
    trello_token: Optional[str] = None
    trello_board_id: Optional[str] = None
    github_token: Optional[str] = None
    github_repo: Optional[str] = None
    enabled_integrations: Optional[dict] = None

class TriggerPayload(BaseModel):
    target: str # notion, jira, slack, discord, trello, github

class WebhookCreate(BaseModel):
    url: str
    events: List[str]

class APIKeyCreate(BaseModel):
    name: string = "Production API Key"

# Helper to trigger webhook delivery
def dispatch_webhook_event(db: Session, user_id: int, event_type: str, payload_data: dict):
    hooks = db.query(WebhookConfig).filter(WebhookConfig.user_id == user_id, WebhookConfig.is_active == True).all()
    for hook in hooks:
        if event_type in hook.events:
            # Prepare payload
            body = {
                "event": event_type,
                "timestamp": str(datetime.now(timezone.utc)),
                "data": payload_data
            }
            
            status_code = 200
            resp_text = "Success (Simulated)"
            
            # Send HTTP post
            try:
                # Set a short timeout to prevent blocking
                resp = requests.post(hook.url, json=body, headers={"X-MeetFlow-Signature": hook.secret}, timeout=3.5)
                status_code = resp.status_code
                resp_text = resp.text[:500]
            except Exception as e:
                status_code = 500
                resp_text = f"Delivery failed: {str(e)}"
                
            # Log delivery
            log = WebhookLog(
                webhook_id=hook.id,
                event=event_type,
                status_code=status_code,
                payload=json.dumps(body),
                response_text=resp_text
            )
            db.add(log)
    db.commit()

@router.get("/settings")
def get_integration_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sett = db.query(IntegrationSetting).filter(IntegrationSetting.user_id == current_user.id).first()
    if not sett:
        sett = IntegrationSetting(
            user_id=current_user.id,
            enabled_integrations={"slack": True, "notion": True, "jira": False, "github": False}
        )
        db.add(sett)
        db.commit()
        db.refresh(sett)
    return sett

@router.put("/settings")
def update_integration_settings(payload: IntegrationSettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sett = db.query(IntegrationSetting).filter(IntegrationSetting.user_id == current_user.id).first()
    if not sett:
        sett = IntegrationSetting(user_id=current_user.id)
        db.add(sett)
        
    if payload.slack_webhook is not None:
        sett.slack_webhook = payload.slack_webhook
    if payload.discord_webhook is not None:
        sett.discord_webhook = payload.discord_webhook
    if payload.notion_token is not None:
        sett.notion_token = payload.notion_token
    if payload.notion_database_id is not None:
        sett.notion_database_id = payload.notion_database_id
    if payload.jira_url is not None:
        sett.jira_url = payload.jira_url
    if payload.jira_token is not None:
        sett.jira_token = payload.jira_token
    if payload.jira_project is not None:
        sett.jira_project = payload.jira_project
    if payload.trello_token is not None:
        sett.trello_token = payload.trello_token
    if payload.trello_board_id is not None:
        sett.trello_board_id = payload.trello_board_id
    if payload.github_token is not None:
        sett.github_token = payload.github_token
    if payload.github_repo is not None:
        sett.github_repo = payload.github_repo
    if payload.enabled_integrations is not None:
        sett.enabled_integrations = payload.enabled_integrations
        
    db.commit()
    return {"success": True}

@router.post("/meetings/{meeting_id}/trigger")
def trigger_workflow_automation(meeting_id: str, payload: TriggerPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    summary = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting_id).first()
    summary_text = summary.summary_text if summary else "Alignment meeting discussions."
    
    target = payload.target.lower()
    details = f"Triggered workflow export to {target}"
    
    # Simulate execution actions
    if target == "notion":
        details = f"Notion integration: Created database page for '{meeting.title}'"
    elif target == "jira":
        details = f"Jira integration: Created task ticket MF-103 'Integrate layout modules' assigned to Developer"
    elif target == "slack":
        details = f"Slack integration: Sent summary reminding notice to channel #general"
    elif target == "github":
        details = f"GitHub integration: Created issue #45 'Auth module refactor' linked to this meeting summary"
    elif target == "trello":
        details = f"Trello integration: Appended item cards on Project board backlog list"
    else:
        details = f"Discord integration: Sent announcement webhook remind alerts"
        
    # Dispatch webhook event logs
    dispatch_webhook_event(db, current_user.id, f"ai.summary.{target}.exported", {
        "meeting_id": meeting_id,
        "title": meeting.title,
        "exported_details": details
    })
    
    return {"success": True, "message": details}

@router.get("/webhooks")
def list_webhooks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(WebhookConfig).filter(WebhookConfig.user_id == current_user.id).all()

@router.post("/webhooks")
def create_webhook(payload: WebhookCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    hook = WebhookConfig(
        user_id=current_user.id,
        url=payload.url,
        events=payload.events
    )
    db.add(hook)
    db.commit()
    db.refresh(hook)
    return hook

@router.delete("/webhooks/{webhook_id}")
def delete_webhook(webhook_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    hook = db.query(WebhookConfig).filter(WebhookConfig.id == webhook_id, WebhookConfig.user_id == current_user.id).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook config not found")
    db.delete(hook)
    db.commit()
    return {"success": True}

@router.get("/webhooks/logs")
def get_webhook_delivery_logs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    logs = db.query(WebhookLog).join(WebhookConfig).filter(WebhookConfig.user_id == current_user.id).order_by(WebhookLog.timestamp.desc()).limit(100).all()
    return [{
        "id": l.id,
        "event": l.event,
        "status_code": l.status_code,
        "payload": l.payload,
        "response_text": l.response_text,
        "timestamp": l.timestamp
    } for l in logs]

@router.post("/webhooks/logs/{log_id}/retry")
def retry_webhook_delivery(log_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = db.query(WebhookLog).filter(WebhookLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Webhook log entry not found")
        
    hook = db.query(WebhookConfig).filter(WebhookConfig.id == log.webhook_id).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Active webhook endpoint missing")
        
    status_code = 200
    resp_text = "Retried delivery (Success Simulated)"
    
    try:
        resp = requests.post(hook.url, data=log.payload, headers={"X-MeetFlow-Signature": hook.secret, "Content-Type": "application/json"}, timeout=3.5)
        status_code = resp.status_code
        resp_text = resp.text[:500]
    except Exception as e:
        status_code = 500
        resp_text = f"Retry delivery failed: {str(e)}"
        
    log.status_code = status_code
    log.response_text = resp_text
    log.timestamp = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    
    return {"success": True, "status_code": status_code, "response_text": resp_text}

@router.get("/api-keys")
def list_api_keys(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    keys = db.query(APIKey).filter(APIKey.user_id == current_user.id).all()
    return [{
        "id": k.id,
        "name": k.name,
        "created_at": k.created_at,
        "expires_at": k.expires_at
    } for k in keys]

@router.post("/api-keys")
def create_api_key(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    raw_key = f"mf_key_{uuid.uuid4().hex}"
    # In real apps we would save a hash, but here we can return the key hash string as mock token
    new_key = APIKey(
        user_id=current_user.id,
        key_hash=raw_key,
        name=f"Key generated on {datetime.now().strftime('%Y-%m-%d')}"
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    return {"id": new_key.id, "name": new_key.name, "token": raw_key}

@router.delete("/api-keys/{key_id}")
def revoke_api_key(key_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    key = db.query(APIKey).filter(APIKey.id == key_id, APIKey.user_id == current_user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key token not found")
    db.delete(key)
    db.commit()
    return {"success": True}
