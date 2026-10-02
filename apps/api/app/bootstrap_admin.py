import asyncio
import getpass

from sqlalchemy import select

from .db import SessionLocal
from .models import User, UserRole
from .security import hasher, normalize_email, normalize_phone


async def main():
    email = normalize_email(input("Admin email: "))
    phone = normalize_phone(input("Admin mobile: "))
    name = input("Admin full name: ").strip()
    password = getpass.getpass("New password (12+ characters): ")
    if len(password) < 12 or len(name) < 2:
        raise ValueError("Invalid name or password")
    async with SessionLocal.begin() as db:
        if await db.scalar(select(User.id).where(User.email == email)):
            raise ValueError("User exists; role grants need operator review")
        u = User(email=email, phone_number=phone, full_name=name, password_hash=hasher.hash(password))
        db.add(u)
        await db.flush()
        db.add(UserRole(user_id=u.id, role="SUPER_ADMIN"))
    print("Admin created. No password was logged.")


if __name__ == "__main__":
    asyncio.run(main())
