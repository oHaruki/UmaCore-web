import { query } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveActiveClub } from '@/lib/active-club'
import { PageHeader, NoClub, EmptyState } from '@/components/dash/ui'

type LogEntry = {
  id: string
  actor_name: string
  action: string
  entity_type: string
  entity_id: string | null
  club_name: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  'club.create':       { label: 'Club created',        color: 'bg-info/15 text-info' },
  'club.update':       { label: 'Club updated',         color: 'bg-info/15 text-info' },
  'club.activate':     { label: 'Club reactivated',     color: 'bg-good/15 text-good' },
  'club.delete':       { label: 'Club deleted',         color: 'bg-bad/15 text-bad' },
  'club.recalculate':  { label: 'Recalculated',         color: 'bg-surface-3 text-fg-muted' },
  'club.reset_month':  { label: 'Month reset',          color: 'bg-bad/15 text-bad' },
  'member.create':     { label: 'Member added',         color: 'bg-good/15 text-good' },
  'member.deactivate': { label: 'Member deactivated',   color: 'bg-warn/15 text-warn' },
  'member.reactivate': { label: 'Member reactivated',   color: 'bg-good/15 text-good' },
  'member.update':     { label: 'Member updated',       color: 'bg-info/15 text-info' },
  'quota_req.create':  { label: 'Quota req. added',     color: 'bg-brand/15 text-brand' },
  'quota_req.delete':  { label: 'Quota req. removed',   color: 'bg-warn/15 text-warn' },
  'club.editor.add':   { label: 'Editor role added',    color: 'bg-good/15 text-good' },
  'club.editor.remove':{ label: 'Editor role removed',  color: 'bg-warn/15 text-warn' },
  'guild.manager.add':    { label: 'Manager role added',   color: 'bg-good/15 text-good' },
  'guild.manager.remove': { label: 'Manager role removed', color: 'bg-warn/15 text-warn' },
  'sync.trigger':      { label: 'Sync triggered',       color: 'bg-surface-3 text-fg-muted' },
}

function formatDetails(action: string, details: Record<string, unknown> | null): string | null {
  if (!details) return null
  switch (action) {
    case 'club.create':
      return `${details.club_name} · ${Number(details.daily_quota).toLocaleString()} fans/day`
    case 'club.update': {
      const ch = details.changes as Record<string, unknown> | undefined
      if (!ch) return null
      return Object.entries(ch).map(([k, v]) => `${k}: ${v}`).join(', ')
    }
    case 'member.create':
      return `${details.trainer_name} (ID: ${details.trainer_id})`
    case 'member.deactivate':
    case 'member.reactivate':
      return String(details.trainer_name ?? '')
    case 'member.update': {
      const ch = details.changes as Record<string, unknown> | undefined
      const base = String(details.trainer_name ?? '')
      if (!ch || !Object.keys(ch).length) return base
      return `${base} · ${Object.entries(ch).map(([k, v]) => `${k}: ${v}`).join(', ')}`
    }
    case 'quota_req.create':
      return `${details.effective_date} · ${Number(details.daily_quota).toLocaleString()} fans/day`
    case 'quota_req.delete':
      // Dashboard deletes by id and records nothing; /delete_quota targets a
      // date + amount, so show those when they're there.
      if (details.effective_date == null) return null
      return `${details.effective_date} · ${Number(details.daily_quota).toLocaleString()} fans/day`
    case 'club.activate':
    case 'club.delete':
    case 'club.reset_month':
      return String(details.club_name ?? '')
    case 'club.recalculate': {
      const parts: string[] = [`${Number(details.rows_written ?? 0).toLocaleString()} rows rewritten`]
      if (Number(details.fans_corrected) > 0) parts.push(`${details.fans_corrected} fan totals fixed`)
      if (Number(details.rows_added) > 0) parts.push(`${details.rows_added} days filled`)
      if (Number(details.join_dates_fixed) > 0) parts.push(`${details.join_dates_fixed} join dates`)
      return parts.join(' · ')
    }
    case 'club.editor.add':
    case 'club.editor.remove':
    case 'guild.manager.add':
    case 'guild.manager.remove':
      return details.role_name ? `@${details.role_name}` : `role ${details.role_id}`
    case 'sync.trigger':
      if (details.success === false) return `failed: ${details.error ?? 'unknown'}`
      if (details.updated_members != null) return `${details.updated_members} members updated`
      return null
    default:
      return null
  }
}

export default async function AuditLogPage() {
  const session = await auth()
  const { active } = session ? await resolveActiveClub(session) : { active: null }

  if (!active) {
    return (
      <NoClub title="Audit log" />
    )
  }

  // Guild-scoped actions (manager roles, club deletion) have no club_id to hang
  // off — they're matched on details.guild_id so they show on every club page in
  // that server rather than being invisible everywhere.
  const logs = await query<LogEntry>(`
    SELECT
      al.id,
      al.actor_name,
      al.action,
      al.entity_type,
      al.entity_id::text,
      c.club_name,
      al.details,
      al.created_at::text
    FROM audit_logs al
    LEFT JOIN clubs c ON c.club_id = al.club_id
    WHERE al.club_id = $1
       OR ($2::text IS NOT NULL
           AND al.club_id IS NULL
           AND al.details->>'guild_id' = $2)
    ORDER BY al.created_at DESC
    LIMIT 200
  `, [active.club_id, active.guild_id]).catch(() => [] as LogEntry[])

  return (
    <div className="rise space-y-6">
      <PageHeader title="Audit log" description={`Changes made to ${active.club_name} from the dashboard or bot commands. Shows the latest 200.`} />

      {logs.length === 0 ? (
        <div className="panel">
          <EmptyState title="Nothing recorded yet" body="Edits to the club, its members and its quota show up here." />
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="divide-y divide-line">
            {logs.map(log => {
              const meta = ACTION_META[log.action] ?? { label: log.action, color: 'bg-surface-3 text-fg-muted' }
              const detail = formatDetails(log.action, log.details)
              const viaDiscord = log.details?.via === 'discord'
              const ts = new Date(log.created_at)
              return (
                <div key={log.id} className="px-5 py-3 flex items-center gap-4">
                  {/* Timestamp */}
                  <div className="shrink-0 w-32">
                    <p className="text-xs text-fg-muted">{ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[11px] text-fg-subtle">{ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  {/* Actor — entries without a source tag predate command logging and came from the dashboard */}
                  <div className="shrink-0 w-28">
                    <p className="text-xs text-fg-soft truncate">{log.actor_name}</p>
                    <p className="text-[11px] text-fg-subtle">{viaDiscord ? 'via command' : 'via dashboard'}</p>
                  </div>

                  {/* Action badge */}
                  <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded ${meta.color}`}>
                    {meta.label}
                  </span>

                  {/* Club */}
                  {log.club_name && (
                    <span className="shrink-0 text-[11px] text-fg-subtle">{log.club_name}</span>
                  )}

                  {/* Detail */}
                  {detail && (
                    <p className="text-xs text-fg-muted truncate min-w-0">{detail}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
