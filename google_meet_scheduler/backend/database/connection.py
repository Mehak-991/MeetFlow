import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/meetflow")

# Fallback mechanism to SQLite if PostgreSQL connection fails
try:
    # If the URL is postgresql, use a short connect_timeout to fail fast if the server is down
    connect_args = {"connect_timeout": 3} if "postgresql" in DATABASE_URL else {}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    # Test connection
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"Warning: Failed to connect to PostgreSQL ({e}). Falling back to local SQLite database.")
    DATABASE_URL = "sqlite:///./meetflow_fallback.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
