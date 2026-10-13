import {randomUUID} from 'node:crypto';
import type {Row, Tx} from './db.ts';

export async function emit(tx: Tx, kind: string, entityId: string, recipients: string[], route: string) {
  const id = randomUUID();
  const payload = {route, entity_id: entityId};
  await tx.query('INSERT INTO domain_events (id, type, aggregate_id, payload) VALUES ($1, $2, $3, $4)', [id, kind, entityId, payload]);
  // The in-app handler runs in the same transaction. External delivery reads undelivered outbox events.
  for (const recipient of new Set(recipients)) {
    await tx.query(
      'INSERT INTO notifications (id, recipient_id, event_id, kind, payload) VALUES ($1, $2, $3, $4, $5)',
      [randomUUID(), recipient, id, kind, payload],
    );
  }
  return {id, type: kind, aggregate_id: entityId, payload};
}

export async function audit(tx: Tx, actor: Row, action: string, entityId: string, requestId: string, details: Row = {}) {
  await tx.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_id, request_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
    [randomUUID(), actor.id, action, entityId, requestId, details],
  );
}
