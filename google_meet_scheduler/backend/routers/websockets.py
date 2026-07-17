from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio
import json
from datetime import datetime, timezone

router = APIRouter(prefix="/api/ws", tags=["websockets"])

class ConnectionManager:
    def __init__(self):
        # Maps meeting_id -> list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Maps meeting_id -> background task for countdown
        self.countdown_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []
        self.active_connections[meeting_id].append(websocket)
        
        # Start a background countdown task if it doesn't exist yet
        if meeting_id not in self.countdown_tasks:
            self.countdown_tasks[meeting_id] = asyncio.create_task(self.meeting_countdown_loop(meeting_id))

    def disconnect(self, websocket: WebSocket, meeting_id: str):
        if meeting_id in self.active_connections:
            if websocket in self.active_connections[meeting_id]:
                self.active_connections[meeting_id].remove(websocket)
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]
                # Cancel countdown task if no connections are left
                if meeting_id in self.countdown_tasks:
                    self.countdown_tasks[meeting_id].cancel()
                    del self.countdown_tasks[meeting_id]

    async def broadcast_to_meeting(self, meeting_id: str, message: dict):
        if meeting_id in self.active_connections:
            # Create a list copy to prevent mutation during iteration
            for connection in list(self.active_connections[meeting_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be closed, we'll clean it up or ignore
                    pass

    async def meeting_countdown_loop(self, meeting_id: str):
        try:
            while True:
                # In a real app, we would query the meeting end_time from DB.
                # For this real-time simulator, we'll broadcast a tick event every 5 seconds.
                now = datetime.now(timezone.utc)
                await self.broadcast_to_meeting(meeting_id, {
                    "type": "TICK",
                    "timestamp": now.isoformat(),
                })
                await asyncio.sleep(5)
        except asyncio.CancelledError:
            pass

manager = ConnectionManager()

@router.websocket("/meetings/{meeting_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str):
    await manager.connect(websocket, meeting_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # Expecting format like: {"type": "JOIN", "name": "User", "email": "user@test.com"}
                # Broadcast the message to everyone in the meeting
                await manager.broadcast_to_meeting(meeting_id, message)
            except Exception as e:
                print(f"Error parsing websocket message: {e}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, meeting_id)
        # Notify others
        await manager.broadcast_to_meeting(meeting_id, {
            "type": "LEAVE",
            "message": "A participant has disconnected"
        })
