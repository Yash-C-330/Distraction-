from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import random


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Motivational Quotes
MOTIVATIONAL_QUOTES = [
    "Stay focused, be present 🌱",
    "Your focus determines your reality ✨",
    "One step at a time, one breath at a time 🧘",
    "The secret of change is to focus all your energy not on fighting the old, but on building the new 🌟",
    "Concentrate all your thoughts upon the work at hand 🎯",
    "Focus is a matter of deciding what things you're not going to do 💡",
    "Where focus goes, energy flows 🔥",
    "The successful warrior is the average person, with laser-like focus 🗡️",
    "Stay present. Stay focused. Stay calm 🌊",
    "Deep work leads to deep rewards 📚"
]

# Define Models
class FocusSession(BaseModel):
    userId: str = "default_user"
    startTime: datetime
    endTime: Optional[datetime] = None
    duration: int  # in minutes
    completed: bool = False
    quote: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class FocusSessionCreate(BaseModel):
    duration: int  # in minutes
    userId: str = "default_user"

class FocusSessionComplete(BaseModel):
    sessionId: str
    userId: str = "default_user"

class UserStats(BaseModel):
    userId: str = "default_user"
    totalHours: float = 0.0
    sessionsCount: int = 0
    currentStreak: int = 0
    lastSessionDate: Optional[datetime] = None
    weeklyData: List[float] = Field(default_factory=lambda: [0.0] * 7)

class Schedule(BaseModel):
    userId: str = "default_user"
    time: str  # HH:MM format
    days: List[str]  # ["Mon", "Tue", etc.]
    enabled: bool = True
    name: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class ScheduleCreate(BaseModel):
    time: str
    days: List[str]
    name: str
    userId: str = "default_user"

# Routes
@api_router.get("/")
async def root():
    return {"message": "NoScreen API"}

@api_router.get("/quotes")
async def get_random_quote():
    """Get a random motivational quote"""
    return {"quote": random.choice(MOTIVATIONAL_QUOTES)}

@api_router.post("/sessions/start")
async def start_session(session_data: FocusSessionCreate):
    """Start a new focus session"""
    quote = random.choice(MOTIVATIONAL_QUOTES)
    session = FocusSession(
        userId=session_data.userId,
        startTime=datetime.utcnow(),
        duration=session_data.duration,
        quote=quote
    )
    
    result = await db.focus_sessions.insert_one(session.dict())
    session_dict = session.dict()
    session_dict["_id"] = str(result.inserted_id)
    
    return session_dict

@api_router.post("/sessions/complete")
async def complete_session(complete_data: FocusSessionComplete):
    """Complete a focus session and update stats"""
    from bson import ObjectId
    
    # Find and update the session
    session = await db.focus_sessions.find_one({"_id": ObjectId(complete_data.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    end_time = datetime.utcnow()
    await db.focus_sessions.update_one(
        {"_id": ObjectId(complete_data.sessionId)},
        {"$set": {"endTime": end_time, "completed": True}}
    )
    
    # Calculate actual duration in hours
    start_time = session["startTime"]
    actual_duration = (end_time - start_time).total_seconds() / 3600
    
    # Update user stats
    stats = await db.user_stats.find_one({"userId": complete_data.userId})
    
    if not stats:
        # Create new stats
        stats = UserStats(userId=complete_data.userId)
        stats.totalHours = actual_duration
        stats.sessionsCount = 1
        stats.currentStreak = 1
        stats.lastSessionDate = end_time
        
        # Update weekly data (today)
        day_of_week = end_time.weekday()
        stats.weeklyData[day_of_week] += actual_duration
        
        await db.user_stats.insert_one(stats.dict())
    else:
        # Update existing stats
        new_total_hours = stats["totalHours"] + actual_duration
        new_sessions_count = stats["sessionsCount"] + 1
        
        # Calculate streak
        last_session_date = stats.get("lastSessionDate")
        current_streak = stats.get("currentStreak", 0)
        
        if last_session_date:
            days_diff = (end_time.date() - last_session_date.date()).days
            if days_diff == 0:
                # Same day
                current_streak = stats.get("currentStreak", 1)
            elif days_diff == 1:
                # Consecutive day
                current_streak += 1
            else:
                # Streak broken
                current_streak = 1
        else:
            current_streak = 1
        
        # Update weekly data
        weekly_data = stats.get("weeklyData", [0.0] * 7)
        day_of_week = end_time.weekday()
        weekly_data[day_of_week] += actual_duration
        
        await db.user_stats.update_one(
            {"userId": complete_data.userId},
            {"$set": {
                "totalHours": new_total_hours,
                "sessionsCount": new_sessions_count,
                "currentStreak": current_streak,
                "lastSessionDate": end_time,
                "weeklyData": weekly_data
            }}
        )
    
    return {"message": "Session completed", "duration": actual_duration}

@api_router.get("/sessions/history")
async def get_session_history(userId: str = "default_user", limit: int = 50):
    """Get session history for a user"""
    sessions = await db.focus_sessions.find(
        {"userId": userId}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    for session in sessions:
        session["_id"] = str(session["_id"])
    
    return sessions

@api_router.get("/stats")
async def get_stats(userId: str = "default_user"):
    """Get user statistics"""
    stats = await db.user_stats.find_one({"userId": userId})
    
    if not stats:
        # Return default stats
        default_stats = UserStats(userId=userId)
        return default_stats.dict()
    
    stats["_id"] = str(stats["_id"])
    return stats

@api_router.post("/schedules")
async def create_schedule(schedule_data: ScheduleCreate):
    """Create a new schedule"""
    schedule = Schedule(
        userId=schedule_data.userId,
        time=schedule_data.time,
        days=schedule_data.days,
        name=schedule_data.name
    )
    
    result = await db.schedules.insert_one(schedule.dict())
    schedule_dict = schedule.dict()
    schedule_dict["_id"] = str(result.inserted_id)
    
    return schedule_dict

@api_router.get("/schedules")
async def get_schedules(userId: str = "default_user"):
    """Get all schedules for a user"""
    schedules = await db.schedules.find({"userId": userId}).to_list(100)
    
    for schedule in schedules:
        schedule["_id"] = str(schedule["_id"])
    
    return schedules

@api_router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete a schedule"""
    from bson import ObjectId
    
    result = await db.schedules.delete_one({"_id": ObjectId(schedule_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return {"message": "Schedule deleted"}

@api_router.patch("/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: str):
    """Toggle schedule enabled status"""
    from bson import ObjectId
    
    schedule = await db.schedules.find_one({"_id": ObjectId(schedule_id)})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    new_status = not schedule.get("enabled", True)
    
    await db.schedules.update_one(
        {"_id": ObjectId(schedule_id)},
        {"$set": {"enabled": new_status}}
    )
    
    return {"enabled": new_status}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
