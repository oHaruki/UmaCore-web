import { query } from '@/lib/db'
import { auth } from '@/lib/auth'

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
  'club.create':       { label: 'Club created',        color: 'bg-sky-500/15 text-sky-300' },
  'club.update':       { label: 'Club updated',         color: 'bg-sky-500/15 text-sky-300' },
  'member.create':     { label: 'Member added',         color: 'bg-emerald-500/15 text-emerald-300' },
  'member.deactivate': { label: 'Member deactivated',   color: 'bg-amber-500/15 text-amber-300' },
  'member.reactivate': { label: 'Member reactivated',   color: 'bg-emerald-500/15 text-emerald-300' },
  'member.update':     { label: 'Member updated',       color: 'bg-sky-500/15 text-sky-300' },
  'quota_req.create':  { label: 'Quota req. added',     color: 'bg-violet-500/15 text-violet-300' },
  'quota_req.delete':  { label: 'Quota req. removed',   color: 'bg-amber-500/15 text-amber-300' },
  'sync.trigger':      { label: 'Sync triggered',       color: 'bg-zinc-500/15 text-zinc-400' },
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
      return null
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
  const guildIds = session?.adminGuildIds ?? []

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
    WHERE c.guild_id::text = ANY($1::text[])
       OR al.club_id IS NULL
    ORDER BY al.created_at DESC
    LIMIT 200
  `, [guildIds]).catch(() => [] as LogEntry[])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Audit Log</h1>
        <p className="text-xs text-zinc-500 mt-0.5">All admin actions across your clubs — last 200 entries</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg px-5 py-10 text-center">
          <p className="text-xs text-zinc-600">No actions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-[#0d0d14] border border-white/5 rounded-lg overflow-hidden">
          <div className="divide-y divide-white/5">
            {logs.map(log => {
              const meta = ACTION_META[log.action] ?? { label: log.action, color: 'bg-zinc-500/15 text-zinc-400' }
              const detail = formatDetails(log.action, log.details)
              const ts = new Date(log.created_at)
              return (
                <div key={log.id} className="px-5 py-3 flex items-center gap-4">
                  {/* Timestamp */}
                  <div className="shrink-0 w-32">
                    <p className="text-[11px] text-zinc-400">{ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[10px] text-zinc-600">{ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  {/* Actor */}
                  <div className="shrink-0 w-28">
                    <p className="text-xs text-zinc-300 truncate">{log.actor_name}</p>
                  </div>

                  {/* Action badge */}
                  <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded ${meta.color}`}>
                    {meta.label}
                  </span>

                  {/* Club */}
                  {log.club_name && (
                    <span className="shrink-0 text-[10px] text-zinc-600">{log.club_name}</span>
                  )}

                  {/* Detail */}
                  {detail && (
                    <p className="text-xs text-zinc-500 truncate min-w-0">{detail}</p>
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
