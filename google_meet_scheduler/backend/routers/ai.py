import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional

from ..database.connection import get_db
from ..models.models import Meeting, MeetingNote, MeetingRecording, MeetingSummary, User
from ..utils.auth import get_current_user
from ..services.ai_service import transcribe_audio, generate_meeting_summary, generate_followup_email

router = APIRouter(prefix="/api/meetings/{meeting_id}/ai", tags=["ai"])

# Ensure temp upload directory exists
UPLOAD_DIR = "./temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
        # Clean up temp file
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
    # Save recording record
    recording = MeetingRecording(
        meeting_id=meeting_id,
        file_path=temp_file_path,
        duration=0 # we can set duration if needed
    )
    db.add(recording)

    # Save summary record
    summary = MeetingSummary(
        meeting_id=meeting_id,
        summary_text=ai_data["summary_text"],
        action_items=ai_data["action_items"],
        key_decisions=ai_data["key_decisions"]
    )
    db.add(summary)

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
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.organizer_email == current_user.email).first()
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
