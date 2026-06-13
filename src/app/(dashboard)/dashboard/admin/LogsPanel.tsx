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
  { label: 'ALL',     color: 'text-zinc-400',   active: 'bg-zinc-700 text-white' },
  { label: 'INFO',    color: 'text-zinc-400',   active: 'bg-zinc-600 text-white' },
  { label: 'WARNING', color: 'text-yellow-500', active: 'bg-yellow-600/80 text-white' },
  { label: 'ERROR',   color: 'text-red-500',    active: 'bg-red-600/80 text-white' },
]

function levelOf(line: string): Level {
  if (line.includes('ERROR'))   return 'ERROR'
  if (line.includes('WARNING')) return 'WARNING'
  return 'INFO'
}

function lineColor(line: string): string {
  if (line.includes('ERROR'))   return 'text-red-400'
  if (line.includes('WARNING')) return 'text-yellow-400'
  if (line.includes('✅'))      return 'text-green-400'
  return 'text-zinc-400'
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
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Bot Logs
          {totalInFile != null && (
            <span className="ml-2 text-zinc-600 font-normal normal-case">
              ({allLines.length.toLocaleString()} shown / {totalInFile.toLocaleString()} total)
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Level filters */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {LEVELS.map(({ label, color, active }) => (
              <button
                key={label}
                onClick={() => setLevel(label)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  level === label ? active : `${color} hover:bg-white/5`
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
            className="bg-white/5 border border-white/10 text-zinc-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
          >
            {LINE_OPTIONS.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="accent-violet-500"
            />
            Auto (10s)
          </label>

          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-[#0d0d14] h-[600px] overflow-y-auto p-4 font-mono text-xs leading-5">
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-zinc-600">No {level !== 'ALL' ? level : ''} log lines.</p>
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
