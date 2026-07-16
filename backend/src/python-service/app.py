import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(
    title="MeetFlow AI Meeting Intelligence Service",
    description="FastAPI service for semantic analysis, RAG, and NLP processing.",
    version="1.0.0"
)

class TranscriptChunk(BaseModel):
    speaker: str
    text: str
    timestamp: Optional[str] = None

class MeetingAnalysisRequest(BaseModel):
    meetingCode: str
    chunks: List[TranscriptChunk]

class QuestionRequest(BaseModel):
    meetingCode: str
    question: str
    chunks: List[TranscriptChunk]

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "MeetFlow AI Intelligence"}

@app.post("/analyze-meeting")
def analyze_meeting(request: MeetingAnalysisRequest):
    """
    Extracts summary, key topics, decisions, sentiment, and speaker balance.
    """
    if not request.chunks:
        raise HTTPException(status_code=400, detail="Transcript is empty.")
    
    full_text = "\n".join([f"{c.speaker}: {c.text}" for c in request.chunks])
    
    # NLP calculations: Word frequencies and speaker statistics
    speaker_words = {}
    total_words = 0
    questions_count = 0
    
    for c in request.chunks:
        words = len(c.text.split())
        total_words += words
        speaker_words[c.speaker] = speaker_words.get(c.speaker, 0) + words
        if "?" in c.text:
            questions_count += 1
            
    # Calculate balance score
    participation = []
    for speaker, words in speaker_words.items():
        percentage = round((words / max(1, total_words)) * 100, 1)
        participation.append({"speaker": speaker, "score": percentage, "words": words})
        
    participation.sort(key=lambda x: x["words"], reverse=True)
    
    # Sentiment calculation
    positive_words = ["agree", "good", "great", "excellent", "perfect", "yes", "support", "done"]
    negative_words = ["disagree", "bad", "no", "difficult", "blocker", "risk", "fail", "delay"]
    
    pos_count = sum(1 for w in positive_words if w in full_text.lower())
    neg_count = sum(1 for w in negative_words if w in full_text.lower())
    
    sentiment = "Neutral"
    if pos_count > neg_count:
        sentiment = "Positive"
    elif neg_count > pos_count:
        sentiment = "Needs Review"
        
    # Mock extract metrics (would connect to Gemini/OpenAI in production)
    return {
        "summary": "This meeting discussed platform implementation details, system integrations, and task assignments.",
        "keyDecisions": [
            "Approved architecture layout updates for fullscreen viewport constraints.",
            "Agreed to start parallel backend server in nodemon dev mode."
        ],
        "actionItems": [
            {"task": "Update CSS module class rules", "owner": request.chunks[0].speaker if request.chunks else "Host", "priority": "High"},
            {"task": "Configure automated database verify tests", "owner": "Unassigned", "priority": "Medium"}
        ],
        "analytics": {
            "totalWords": total_words,
            "questionsAsked": questions_count,
            "sentimentTrend": sentiment,
            "participation": participation,
            "effectivenessScore": 85 if total_words > 50 else 60
        }
    }

@app.post("/rag-query")
def rag_query(request: QuestionRequest):
    """
    RAG semantic search over local transcript chunks.
    """
    if not request.chunks:
         return {"answer": "No transcript context available to answer."}
         
    # Simple semantic keyword score routing
    query_words = request.question.lower().split()
    best_chunk = None
    max_score = 0
    
    for c in request.chunks:
        score = sum(1 for w in query_words if w in c.text.lower())
        if score > max_score:
            max_score = score
            best_chunk = c
            
    if best_chunk:
        context_reply = f"Based on the meeting logs, {best_chunk.speaker} said: \"{best_chunk.text}\"."
    else:
        context_reply = "I could not find matching discussion points in the active transcript. Please refine your query."
        
    return {"answer": context_reply}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
