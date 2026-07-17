import os
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from ..database.connection import get_db
from ..models.models import User
from ..utils.auth import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/callback")

class CallbackRequest(BaseModel):
    code: str

@router.get("/url")
def get_auth_url():
    scopes = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar"
    ]
    scope_str = " ".join(scopes)
    
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope={scope_str}&"
        f"access_type=offline&"
        f"prompt=consent"
    )
    return {"url": url}

@router.post("/callback")
def oauth_callback(body: CallbackRequest, db: Session = Depends(get_db)):
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": body.code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    res = requests.post(token_url, data=data)
    if res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google token exchange failed: {res.text}"
        )
        
    tokens = res.json()
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in", 3600)
    
    # Get user profile info
    profile_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    profile_res = requests.get(profile_url, headers=headers)
    if profile_res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to retrieve user profile from Google"
        )
        
    profile = profile_res.json()
    email = profile.get("email")
    name = profile.get("name")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account does not provide email"
        )
        
    user = db.query(User).filter(User.email == email).first()
    expiry_time = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=expires_in)
    
    if not user:
        user = User(
            email=email,
            name=name,
            google_access_token=access_token,
            google_refresh_token=refresh_token,
            google_token_expiry=expiry_time
        )
        db.add(user)
    else:
        user.name = name
        user.google_access_token = access_token
        if refresh_token:
            user.google_refresh_token = refresh_token
        user.google_token_expiry = expiry_time
        
    db.commit()
    db.refresh(user)
    
    jwt_token = create_access_token(data={"sub": user.email})
    
    return {
        "token": jwt_token,
        "email": user.email,
        "name": user.name,
        "has_refresh_token": bool(user.google_refresh_token)
    }
