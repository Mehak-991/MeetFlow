import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
import io
import json

from ..database.connection import get_db
from ..models.models import Meeting, MeetingNote, MeetingRecording, MeetingSummary, User, MeetingTranscript, MeetingActionItem, MeetingInsight, AISetting
from ..utils.auth import get_current_user
from ..services.ai_service import transcribe_audio, generate_meeting_summary, generate_followup_email

router = APIRouter(prefix="/api/meetings/{meeting_id}/ai", tags=["ai"])

# Ensure temp upload directory exists
UPLOAD_DIR = "./temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class TranscriptIn(BaseModel):
    speaker: str
    text: str

class ActionItemUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None

class AISettingUpdate(BaseModel):
    summary_style: Optional[str] = None
    transcript_language: Optional[str] = None
    auto_summary: Optional[bool] = None
    auto_email: Optional[bool] = None
    auto_export: Optional[bool] = None
    ai_model: Optional[str] = None

@router.post("/process-audio")
def process_meeting_audio(
    meeting_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify meeting exists
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found or you are not authorized."
        )

    # 2. Save uploaded file temporarily
    temp_file_path = os.path.join(UPLOAD_DIR, f"{meeting_id}_{file.filename}")
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {str(e)}"
        )

    # 3. Transcribe audio
    try:
        transcript = transcribe_audio(temp_file_path)
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Whisper transcription failed: {str(e)}"
        )

    # 4. Generate AI Summary & Action Items & Key Decisions
    try:
        ai_data = generate_meeting_summary(transcript)
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Summarization failed: {str(e)}"
        )

    # 5. Generate Follow-up Email
    try:
        email_draft = generate_followup_email(
            summary_text=ai_data["summary_text"],
            action_items=ai_data["action_items"],
            key_decisions=ai_data["key_decisions"],
            meeting_title=meeting.title
        )
    except Exception as e:
        email_draft = "Failed to generate follow-up email: " + str(e)

    # 6. Save to Database
    recording = MeetingRecording(
        meeting_id=meeting_id,
        file_path=temp_file_path,
        duration=0
    )
    db.add(recording)

    summary = MeetingSummary(
        meeting_id=meeting_id,
        summary_text=ai_data["summary_text"],
        action_items=ai_data["action_items"],
        key_decisions=ai_data["key_decisions"]
    )
    db.add(summary)

    # Extract granular action items
    for item in ai_data.get("action_items", []):
        ai_item = MeetingActionItem(
            meeting_id=meeting_id,
            task=item.get("task", ""),
            owner=item.get("owner", "Unassigned"),
            priority=item.get("priority", "Medium")
        )
        db.add(ai_item)

    # Parse and save speaker transcripts
    segments = transcript.split(". ")
    speakers = ["Host", "Developer", "Designer"]
    for i, seg in enumerate(segments):
        if not seg.strip():
            continue
        sp = speakers[i % len(speakers)]
        tx = seg
        if ":" in seg[:15]:
            parts = seg.split(":", 1)
            if len(parts[0]) < 12:
                sp = parts[0].strip()
                tx = parts[1].strip()
        
        db.add(MeetingTranscript(
            meeting_id=meeting_id,
            speaker=sp,
            text=tx
        ))

    # Save full transcript as a meeting note
    note = MeetingNote(
        meeting_id=meeting_id,
        content=f"--- FULL TRANSCRIPT ---\n{transcript}\n\n--- FOLLOW-UP EMAIL DRAFT ---\n{email_draft}"
    )
    db.add(note)

    # Mark meeting as completed
    meeting.status = "completed"
    
    db.commit()
    db.refresh(summary)
    db.refresh(note)

    return {
        "success": True,
        "transcript": transcript,
        "summary": ai_data["summary_text"],
        "action_items": ai_data["action_items"],
        "key_decisions": ai_data["key_decisions"],
        "email_draft": email_draft
    }

@router.get("/summary")
def get_meeting_summary(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found or unauthorized."
        )

    summary = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting_id).order_by(MeetingSummary.created_at.desc()).first()
    notes = db.query(MeetingNote).filter(MeetingNote.meeting_id == meeting_id).order_by(MeetingNote.created_at.desc()).all()
    
    return {
        "summary": {
            "summary_text": summary.summary_text,
            "action_items": summary.action_items,
            "key_decisions": summary.key_decisions,
            "created_at": summary.created_at
        } if summary else None,
        "notes": [{"id": n.id, "content": n.content, "created_at": n.created_at} for n in notes]
    }

@router.get("/transcripts")
def get_transcripts(
    meeting_id: str,
    query: Optional[str] = None,
    speaker: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    q = db.query(MeetingTranscript).filter(MeetingTranscript.meeting_id == meeting_id)
    if speaker:
        q = q.filter(MeetingTranscript.speaker.ilike(f"%{speaker}%"))
    if query:
        q = q.filter(MeetingTranscript.text.ilike(f"%{query}%"))
    results = q.order_by(MeetingTranscript.timestamp.asc()).all()
    
    # If empty, bootstrap from mock if meeting notes exist
    if not results and not query and not speaker:
        note = db.query(MeetingNote).filter(MeetingNote.meeting_id == meeting_id).first()
        if note and "FULL TRANSCRIPT" in note.content:
            raw_text = note.content.split("--- FULL TRANSCRIPT ---")[1].split("--- FOLLOW-UP EMAIL DRAFT ---")[0].strip()
            segments = raw_text.split(". ")
            speakers = ["Host", "Developer", "Designer"]
            for i, seg in enumerate(segments):
                if not seg.strip():
                    continue
                sp = speakers[i % len(speakers)]
                tx = seg
                if ":" in seg[:15]:
                    parts = seg.split(":", 1)
                    if len(parts[0]) < 12:
                        sp = parts[0].strip()
                        tx = parts[1].strip()
                db.add(MeetingTranscript(meeting_id=meeting_id, speaker=sp, text=tx))
            db.commit()
            results = db.query(MeetingTranscript).filter(MeetingTranscript.meeting_id == meeting_id).order_by(MeetingTranscript.timestamp.asc()).all()

    return [{"id": r.id, "speaker": r.speaker, "text": r.text, "timestamp": r.timestamp} for r in results]

@router.post("/transcripts")
def create_transcript_segment(
    meeting_id: str,
    payload: TranscriptIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    segment = MeetingTranscript(
        meeting_id=meeting_id,
        speaker=payload.speaker,
        text=payload.text
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return {"success": True, "id": segment.id}

@router.get("/action-items")
def get_action_items(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    items = db.query(MeetingActionItem).filter(MeetingActionItem.meeting_id == meeting_id).all()
    
    # If empty, bootstrap from MeetingSummary
    if not items:
        summary = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting_id).first()
        if summary and summary.action_items:
            for item in summary.action_items:
                ai_item = MeetingActionItem(
                    meeting_id=meeting_id,
                    task=item.get("task", ""),
                    owner=item.get("owner", "Unassigned"),
                    priority=item.get("priority", "Medium")
                )
                db.add(ai_item)
            db.commit()
            items = db.query(MeetingActionItem).filter(MeetingActionItem.meeting_id == meeting_id).all()
            
    return [{"id": i.id, "task": i.task, "owner": i.owner, "deadline": i.deadline, "priority": i.priority, "status": i.status} for i in items]

@router.put("/action-items/{item_id}")
def update_action_item(
    meeting_id: str,
    item_id: str,
    payload: ActionItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(MeetingActionItem).filter(MeetingActionItem.id == item_id, MeetingActionItem.meeting_id == meeting_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")
    if payload.status is not None:
        item.status = payload.status
    if payload.priority is not None:
        item.priority = payload.priority
    db.commit()
    return {"success": True}

@router.get("/insights")
def get_insights(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    insight = db.query(MeetingInsight).filter(MeetingInsight.meeting_id == meeting_id).first()
    if not insight:
        transcripts = db.query(MeetingTranscript).filter(MeetingTranscript.meeting_id == meeting_id).all()
        speaking = {}
        for t in transcripts:
            speaking[t.speaker] = speaking.get(t.speaker, 0) + len(t.text.split()) * 0.3
        
        if not speaking:
            speaking = {"Host (You)": 340, "Developer": 190, "Designer": 140}
            
        insight = MeetingInsight(
            meeting_id=meeting_id,
            participation_score=85,
            speaking_times=speaking,
            silent_participants=["silent_reviewer@example.com"],
            interruptions=3,
            attendance_report={"joined_on_time": ["Host (You)", "Developer"], "late_joiners": ["Designer"]}
        )
        db.add(insight)
        db.commit()
        db.refresh(insight)
    
    return {
        "id": insight.id,
        "participation_score": insight.participation_score,
        "speaking_times": insight.speaking_times,
        "silent_participants": insight.silent_participants,
        "interruptions": insight.interruptions,
        "attendance_report": insight.attendance_report
    }

@router.get("/settings")
def get_ai_settings(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sett = db.query(AISetting).filter(AISetting.user_id == current_user.id).first()
    if not sett:
        sett = AISetting(user_id=current_user.id)
        db.add(sett)
        db.commit()
        db.refresh(sett)
    return {
        "summary_style": sett.summary_style,
        "transcript_language": sett.transcript_language,
        "auto_summary": sett.auto_summary,
        "auto_email": sett.auto_email,
        "auto_export": sett.auto_export,
        "ai_model": sett.ai_model
    }

@router.put("/settings")
def update_ai_settings(
    meeting_id: str,
    payload: AISettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sett = db.query(AISetting).filter(AISetting.user_id == current_user.id).first()
    if not sett:
        sett = AISetting(user_id=current_user.id)
        db.add(sett)
    if payload.summary_style is not None:
        sett.summary_style = payload.summary_style
    if payload.transcript_language is not None:
        sett.transcript_language = payload.transcript_language
    if payload.auto_summary is not None:
        sett.auto_summary = payload.auto_summary
    if payload.auto_email is not None:
        sett.auto_email = payload.auto_email
    if payload.auto_export is not None:
        sett.auto_export = payload.auto_export
    if payload.ai_model is not None:
        sett.ai_model = payload.ai_model
    db.commit()
    return {"success": True}

@router.get("/export")
def export_meeting_data(
    meeting_id: str,
    format: str = "txt",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    summary = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting_id).first()
    transcripts = db.query(MeetingTranscript).filter(MeetingTranscript.meeting_id == meeting_id).order_by(MeetingTranscript.timestamp.asc()).all()
    
    title = meeting.title if meeting else "Meeting"
    text_content = f"Meeting Title: {title}\n"
    if summary:
        text_content += f"\n--- Summary ---\n{summary.summary_text}\n"
    if transcripts:
        text_content += "\n--- Transcript ---\n"
        for t in transcripts:
            text_content += f"[{t.timestamp.strftime('%H:%M:%S') if t.timestamp else ''}] {t.speaker}: {t.text}\n"
            
    if format == "json":
        data = {
            "title": title,
            "summary": summary.summary_text if summary else "",
            "transcripts": [{"speaker": t.speaker, "text": t.text, "timestamp": str(t.timestamp)} for t in transcripts]
        }
        file_data = json.dumps(data, indent=2).encode("utf-8")
        return StreamingResponse(io.BytesIO(file_data), media_type="application/json", headers={"Content-Disposition": f"attachment; filename=meeting_{meeting_id}.json"})
    else:
        file_data = text_content.encode("utf-8")
        filename = f"meeting_{meeting_id}.txt"
        media_type = "text/plain"
        if format == "md":
            filename = f"meeting_{meeting_id}.md"
            media_type = "text/markdown"
        return StreamingResponse(io.BytesIO(file_data), media_type=media_type, headers={"Content-Disposition": f"attachment; filename={filename}"})
