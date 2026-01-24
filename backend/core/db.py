import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("DB", "user")

client = AsyncIOMotorClient(MONGO_URI)
db = client.get_database(MONGO_DB)