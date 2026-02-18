import sys
import os
sys.path.append(os.getcwd())
import asyncio
from app.database import async_session_factory
from app.models import User
from app.auth import hash_password
from sqlalchemy import select

async def main():
    if not async_session_factory:
        print("Database not configured.")
        return

    async with async_session_factory() as session:
        result = await session.execute(select(User))
        user = result.scalars().first()
        if user:
            print(f"EXISTING_USER:{user.email}")
        else:
            print("No users found. Creating admin...")
            admin_email = "admin@nextmedya.com"
            admin_pass = "admin123"
            hashed = hash_password(admin_pass)
            new_user = User(
                email=admin_email,
                hashed_password=hashed,
                username="admin",
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
