import { query } from '@/lib/db'

export async function logAudit(params: {
  actorId: string
  actorName: string
  action: string
  entityType: string
  entityId?: string | null
  clubId?: string | null
  details?: Record<string, unknown>
}) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, club_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.actorId,
        params.actorName,
        params.action,
        params.entityType,
        params.entityId ?? null,
        params.clubId ?? null,
        params.details ? JSON.stringify(params.details) : null,
      ]
    )
  } catch {
    // non-blocking — audit failure must never break the main operation
  }
}
