from openai import OpenAI
import os
import json

def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    return OpenAI(api_key=api_key)

def transcribe_audio(file_path: str) -> str:
    """
    Transcribes the uploaded audio file using OpenAI Whisper.
    Falls back to a realistic mock transcript if no OpenAI API Key is configured.
    """
    client = get_openai_client()
    if not client:
        print("Warning: OPENAI_API_KEY is not set. Using fallback transcript.")
        return (
            "Host: Thank you everyone for joining today's project alignment session. "
            "We need to discuss our release date. "
            "Developer: I think we can launch by next Friday if we finish the auth module. "
            "Designer: Yes, the design for the dashboard is ready. I will share the assets today. "
            "Host: Perfect. Let's set the release date to next Friday. Designer, please deliver the assets. "
            "Developer, please prioritize the auth module."
        )
    
    with open(file_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1", 
            file=audio_file
        )
    return transcript.text

def generate_meeting_summary(transcript: str):
    """
    Analyzes the transcript and extracts summary, action items, and key decisions.
    Falls back to realistic defaults if no OpenAI API Key is configured.
    """
    client = get_openai_client()
    if not client:
        return {
            "summary_text": "The team aligned on the launch date for the project. Key discussion revolved around finishing the auth module and delivering design assets.",
            "action_items": [
                {"task": "Deliver design assets for the dashboard", "owner": "Designer", "priority": "High"},
                {"task": "Complete integration of the auth module", "owner": "Developer", "priority": "High"}
            ],
            "key_decisions": [
                "Set the product release date for next Friday.",
                "Prioritize the auth module for this week."
            ]
        }
        
    prompt = f"""
    You are an AI assistant that analyzes meeting transcripts. Given the transcript below:
    1. Provide a concise summary of the meeting.
    2. Extract a list of action items, including the task name, owner, and priority (High, Medium, Low).
    3. Extract a list of key decisions made.
    
    Transcript:
    \"\"\"{transcript}\"\"\"
    
    Return the response ONLY as a JSON object with the following structure:
    {{
        "summary_text": "string description",
        "action_items": [
            {{"task": "string", "owner": "string", "priority": "string"}}
        ],
        "key_decisions": [
            "string"
        ]
    }}
    """
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a precise meeting assistant. You only respond with JSON."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)

def generate_followup_email(summary_text: str, action_items: list, key_decisions: list, meeting_title: str) -> str:
    """
    Generates a follow-up email based on the meeting notes.
    """
    client = get_openai_client()
    
    action_items_str = "\n".join([f"- {item.get('task')} (Owner: {item.get('owner')}, Priority: {item.get('priority')})" for item in action_items])
    key_decisions_str = "\n".join([f"- {decision}" for decision in key_decisions])
    
    if not client:
        return f"""Subject: Follow-up: {meeting_title}

Hello Team,

Thank you for attending our meeting today: "{meeting_title}".

Here is a summary of what was discussed:
{summary_text}

Key Decisions Made:
{key_decisions_str}

Action Items:
{action_items_str}

Best regards,
Meeting Organizer"""

    prompt = f"""
    Write a professional follow-up email based on the following meeting summary:
    Meeting Title: {meeting_title}
    Summary: {summary_text}
    Key Decisions: {key_decisions_str}
    Action Items: {action_items_str}
    
    Keep it professional, clear, and actionable. Return ONLY the email body.
    """
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional email writer."},
            {"role": "user", "content": prompt}
        ]
    )
    
    return response.choices[0].message.content.strip()
