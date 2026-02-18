import sys
import os
import uuid
sys.path.append(os.getcwd())
import asyncio
from app.database import async_session_factory
from app.models import User
from sqlalchemy import select

# Use bcrypt directly to avoid passlib version check issues
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def main():
    if not async_session_factory:
        print("Database not configured.")
        return

    async with async_session_factory() as session:
        result = await session.execute(select(User))
        user = result.scalars().first()
        if user:
            print(f"EXISTING_USER:{user.email}")
            # If explicit reset needed:
            # user.hashed_password = hash_password("admin123")
            # await session.commit()
            # print(f"RESET_PASSWORD:{user.email}:admin123")
        else:
            print("No users found. Creating admin...")
            admin_email = "admin@nextmedya.com"
            admin_pass = "admin123"
            hashed = hash_password(admin_pass)
            new_user = User(
                id=str(uuid.uuid4()),
                email=admin_email,
                username="admin",
                hashed_password=hashed,
                role="admin",
                is_active=True
            )
            session.add(new_user)
            await session.commit()
            print(f"CREATED_USER:{admin_email}:{admin_pass}")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(main())
