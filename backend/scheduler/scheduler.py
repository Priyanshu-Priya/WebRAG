import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from backend.database.connection import SessionLocal
from backend.database.models import Collection
from backend.services.index_service import IndexingService
from backend.config.config import settings

logger = logging.getLogger(__name__)

# Single scheduler instance
scheduler = AsyncIOScheduler()
index_service = IndexingService()

async def refresh_all_collections_job():
    """Background task that checks all collections and runs a refresh."""
    logger.info("Executing scheduled background refresh for all collections...")
    
    db = SessionLocal()
    try:
        collections = db.query(Collection).all()
        if not collections:
            logger.info("No collections found for background scheduling.")
            return

        for collection in collections:
            # Check if already indexing to prevent overlap
            if collection.status == "Indexing":
                logger.info(f"Collection '{collection.name}' (ID: {collection.id}) is already indexing. Skipping scheduler run.")
                continue

            logger.info(f"Starting background check and refresh for collection: '{collection.name}'")
            # Run index service. Since this runs in background, we do not pass a websocket callback,
            # but it will write warnings/errors/updates to the console log and update status in sqlite.
            await index_service.index_collection(collection.id, db)
            
    except Exception as e:
        logger.error(f"Error in background scheduler job: {e}")
    finally:
        db.close()

def start_scheduler():
    """Starts the background scheduler loop."""
    interval_hours = settings.REFRESH_INTERVAL_HOURS
    logger.info(f"Configuring background scheduler to run every {interval_hours} hour(s).")
    
    # Avoid duplicate jobs on double starts
    scheduler.remove_all_jobs()
    
    scheduler.add_job(
        refresh_all_collections_job,
        "interval",
        hours=interval_hours,
        next_run_time=datetime.now() # Trigger immediately on startup to check freshness
    )
    
    if not scheduler.running:
        scheduler.start()
        logger.info("Background scheduler started successfully.")

def stop_scheduler():
    """Shutdown background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler shut down.")
