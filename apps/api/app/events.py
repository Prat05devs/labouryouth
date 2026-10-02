from .models import AuditLog, DomainEvent, Notification


async def emit(db, kind, entity_id, recipients, route):
    event = DomainEvent(
        type=kind, aggregate_id=entity_id, payload={"route": route, "entity_id": str(entity_id)}
    )
    db.add(event)
    await db.flush()
    # In-app handler executes transactionally. External delivery uses undelivered outbox events.
    for recipient in set(recipients):
        db.add(Notification(recipient_id=recipient, event_id=event.id, kind=kind, payload=event.payload))
    return event


def audit(db, actor, action, entity_id, request_id, details=None):
    db.add(
        AuditLog(
            actor_id=actor.id,
            action=action,
            entity_id=entity_id,
            request_id=request_id,
            details=details or {},
        )
    )
