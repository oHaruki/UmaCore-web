'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'

const LINE_OPTIONS = [
  { label: 'Last 100',  value: '100' },
  { label: 'Last 250',  value: '250' },
  { label: 'Last 500',  value: '500' },
  { label: 'Last 1000', value: '1000' },
  { label: 'Last 2500', value: '2500' },
  { label: 'All',       value: 'all' },
]

type Level = 'ALL' | 'INFO' | 'WARNING' | 'ERROR'

const LEVELS: { label: Level; color: string; active: string }[] = [
  { label: 'ALL',     color: 'text-fg-muted',   active: 'bg-fg-subtle text-fg' },
  { label: 'INFO',    color: 'text-fg-muted',   active: 'bg-fg-subtle text-fg' },
  { label: 'WARNING', color: 'text-warn', active: 'bg-warn/80 text-fg' },
  { label: 'ERROR',   color: 'text-bad',    active: 'bg-bad/80 text-fg' },
]

function levelOf(line: string): Level {
  if (line.includes('ERROR'))   return 'ERROR'
  if (line.includes('WARNING')) return 'WARNING'
  return 'INFO'
}

function lineColor(line: string): string {
  if (line.includes('ERROR'))   return 'text-bad'
  if (line.includes('WARNING')) return 'text-warn'
  if (line.includes('✅'))      return 'text-good'
  return 'text-fg-muted'
}

export default function LogsPanel() {
  const [allLines, setAllLines]     = useState<string[]>([])
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lineCount, setLineCount]   = useState('all')
  const [level, setLevel]           = useState<Level>('ALL')
  const [totalInFile, setTotalInFile] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async (count = lineCount) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/logs?lines=${count}`)
      const data = await res.json()
      if (data.error && !data.lines?.length) {
        setError(data.error)
      } else {
        setError(null)
        setAllLines(data.lines ?? [])
        if (data.total != null) setTotalInFile(data.total)
      }
    } catch {
      setError('Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [lineCount])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => fetchLogs(), 10_000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchLogs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allLines, level])

  const filtered = useMemo(() => {
    const visible = allLines.filter(l => !l.includes('GET /logs'))
    return level === 'ALL' ? visible : visible.filter(l => levelOf(l) === level)
  }, [allLines, level])

  const counts = useMemo(() => ({
    ERROR:   allLines.filter(l => levelOf(l) === 'ERROR').length,
    WARNING: allLines.filter(l => levelOf(l) === 'WARNING').length,
    INFO:    allLines.filter(l => levelOf(l) === 'INFO').length,
  }), [allLines])

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider">
          Bot Logs
          {totalInFile != null && (
            <span className="ml-2 text-fg-subtle font-normal normal-case">
              ({allLines.length.toLocaleString()} shown / {totalInFile.toLocaleString()} total)
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Level filters */}
          <div className="flex items-center gap-1 bg-surface-3 rounded-lg p-1">
            {LEVELS.map(({ label, color, active }) => (
              <button
                key={label}
                onClick={() => setLevel(label)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  level === label ? active : `${color} hover:bg-surface-2`
                }`}
              >
                {label}
                {label !== 'ALL' && (
                  <span className="ml-1 opacity-60">
                    {counts[label as keyof typeof counts]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <select
            value={lineCount}
            onChange={e => {
              const v = e.target.value
              setLineCount(v)
              fetchLogs(v)
            }}
            className="bg-surface-3 border border-line-strong text-fg-soft text-xs rounded-lg px-2 py-1.5 focus:outline-none"
          >
            {LINE_OPTIONS.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="accent-[var(--uc-brand)]"
            />
            Auto (10s)
          </label>

          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-3 text-xs text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface h-[600px] overflow-y-auto p-4 font-mono text-xs leading-5">
        {error ? (
          <p className="text-bad">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-fg-subtle">No {level !== 'ALL' ? level : ''} log lines.</p>
        ) : (
          filtered.map((line, i) => (
            <div key={i} className={lineColor(line)}>{line}</div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}
