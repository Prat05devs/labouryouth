from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import db_session
from .errors import require
from .security import authenticate, roles

DB = Annotated[AsyncSession, Depends(db_session)]


async def current(request: Request, db: DB, authorization: Annotated[str | None, Header()] = None):
    require(authorization and authorization.startswith("Bearer "), "SESSION_EXPIRED", 401)
    user, session = await authenticate(db, authorization[7:])
    request.state.session_id = session.id
    request.state.roles = await roles(db, user.id)
    return user


Actor = Annotated[object, Depends(current)]


def permit(request, *allowed):
    require(bool(set(request.state.roles) & (set(allowed) | {"SUPER_ADMIN"})), "FORBIDDEN", 403)
