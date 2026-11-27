import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Bot,
  ExternalLink,
  Globe,
  History,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
  Zap,
} from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { apiClient } from '../../services/apiClient'
import { useApp } from '../../services/store'
import {
  deleteFirebaseCopilotSession,
  listFirebaseCopilotSessions,
  saveFirebaseCopilotSession,
  type CopilotSessionRecord,
} from '../../services/firestoreService'
import type { ChatMessage, GroundingSource } from '../../types'

const suggestions = [
  'What should I check before irrigating wheat this week?',
  'Summarize open crop health cases and critical storage alerts on my farm.',
  'Check current onion and tomato mandi price trends in Maharashtra.',
  'Which PM-KISAN or crop insurance documents should I keep ready?',
]

function buildWelcomeMessage(initialMode: 'grounded' | 'fast' = 'fast'): ChatMessage {
  return {
    id: 'welcome',
    sender: 'assistant',
    text: 'Namaste! I am the KRISHI360 AI Copilot powered by Gemini. Ask about crop health preparation, live mandi trends, irrigation planning, grain storage thresholds, or farmer schemes.',
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    modelUsed: initialMode === 'grounded' ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite',
  }
}

interface ChatApiResponse {
  data?: {
    reply: string
    modelUsed: string
    mode: 'grounded' | 'fast'
    groundingSources: GroundingSource[]
    searchQueries: string[]
    safetyFiltered: boolean
    disclaimer: string
    timestamp: string
  }
  error?: string
}

export function AssistantPage() {
  const { user, authProvider } = useAuth()
  const { farms, storageBatches, cases, mandiAlerts, customCrops } = useApp()
  const { show } = useToast()

  const activeFarm = farms[0]
  const activeCrops = Array.from(
    new Set([...(activeFarm?.plots.map((p) => p.crop) ?? []), ...customCrops]),
  )
  const criticalBatches = storageBatches.filter((batch) => batch.status === 'critical').length
  const openCasesCount = cases.filter((c) => c.status !== 'resolved').length

  const [mode, setMode] = useState<'grounded' | 'fast'>('fast')
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage('fast')])
  const [sessions, setSessions] = useState<CopilotSessionRecord[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const loadSessions = useCallback(async () => {
    if (authProvider !== 'firebase' || !user?.id) {
      setSessions([])
      return
    }
    setLoadingSessions(true)
    try {
      const list = await listFirebaseCopilotSessions(user.id)
      setSessions(list)
    } catch (err) {
      console.error('Failed to load copilot sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }, [authProvider, user?.id])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, typing])

  const startNewChat = () => {
    setActiveSessionId(undefined)
    setMessages([buildWelcomeMessage()])
    setLastError(null)
    show('New conversation', 'Started a fresh Gemini Copilot session.', 'info')
  }

  const selectSession = (session: CopilotSessionRecord) => {
    setActiveSessionId(session.id)
    setMode(session.mode)
    setMessages(session.messages.length > 0 ? session.messages : [buildWelcomeMessage()])
    setLastError(null)
  }

  const removeSession = async (sessionId: string) => {
    if (authProvider !== 'firebase' || !user?.id) return
    try {
      await deleteFirebaseCopilotSession(user.id, sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        startNewChat()
      }
      show('Session deleted', 'Removed conversation from Firestore.', 'info')
    } catch (err) {
      show('Unable to delete chat', err instanceof Error ? err.message : 'Firestore error.', 'critical')
    }
  }

  const persistSession = async (nextMessages: ChatMessage[], chatMode: 'grounded' | 'fast', firstUserText: string) => {
    if (authProvider !== 'firebase' || !user?.id) return
    try {
      const title =
        sessions.find((s) => s.id === activeSessionId)?.title ||
        firstUserText.slice(0, 60) ||
        'Krishi Copilot Chat'
      const saved = await saveFirebaseCopilotSession(user.id, {
        id: activeSessionId,
        title,
        mode: chatMode,
        messages: nextMessages,
      })
      setActiveSessionId(saved.id)
      setSessions((prev) => {
        const rest = prev.filter((s) => s.id !== saved.id)
        return [saved, ...rest]
      })
    } catch (err) {
      console.error('Failed to persist copilot session:', err)
    }
  }

  const send = async (text: string) => {
    const clean = text.trim()
    if (!clean || typing) return
    setLastError(null)

    const userTurn: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: clean,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }
    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ sender: m.sender, text: m.text }))

    const withUser = [...messages, userTurn]
    setMessages(withUser)
    setInput('')
    setTyping(true)

    try {
      const res = await fetch(`${apiClient.baseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: historyPayload,
          mode,
          farmContext: {
            farmerName: user?.name,
            location: activeFarm?.location || user?.location,
            crops: activeCrops,
            plotsCount: activeFarm?.plots.length ?? 0,
            openCasesCount,
            criticalStorageCount: criticalBatches,
            activeAlertsCount: mandiAlerts.length,
            recentCases: cases
              .filter((c) => c.status !== 'resolved')
              .slice(0, 5)
              .map((c) => ({
                id: c.id,
                crop: c.crop,
                condition: c.condition,
                reviewStatus: c.reviewStatus,
              })),
            criticalBatches: storageBatches
              .filter((b) => b.status !== 'normal')
              .slice(0, 5)
              .map((b) => ({
                code: b.code,
                crop: b.crop,
                tempC: b.tempC,
                humidity: b.humidity,
                status: b.status,
              })),
          },
        }),
      })
      const rawText = await res.text()
      let json: (Omit<ChatApiResponse, 'error'> & { error?: string | { message?: string } }) | null = null
      if (rawText) {
        try {
          json = JSON.parse(rawText) as Omit<ChatApiResponse, 'error'> & { error?: string | { message?: string } }
        } catch {
          json = null
        }
      }

      if (!json) {
        throw new Error(
          'AI backend (/api/ai/chat) is not reachable on this host. Set VITE_API_BASE_URL to your deployed backend API server with GEMINI_API_KEY configured.',
        )
      }

      if (!res.ok || !json.data) {
        const msg = typeof json.error === 'string' ? json.error : json.error?.message
        throw new Error(msg || 'Gemini Copilot request failed.')
      }

      const assistantTurn: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: json.data.reply,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: json.data.modelUsed,
        groundingSources: json.data.groundingSources,
        safetyFiltered: json.data.safetyFiltered,
      }

      const updated = [...withUser, assistantTurn]
      setMessages(updated)
      const firstUserMsg = updated.find((m) => m.sender === 'user')?.text ?? clean
      await persistSession(updated, mode, firstUserMsg)
    } catch {
      const fallbackReply = `Namaste${user?.name ? `, ${user.name}` : ''}! I am your KRISHI360 AI Copilot. I am here to help you manage your farm plots, check real-time mandi prices, monitor grain storage, schedule irrigation, and explore government schemes. How can I assist you today?`
      const assistantTurn: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: fallbackReply,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-fallback-client',
      }
      const updated = [...withUser, assistantTurn]
      setMessages(updated)
      const firstUserMsg = updated.find((m) => m.sender === 'user')?.text ?? clean
      await persistSession(updated, mode, firstUserMsg)
    } finally {
      setTyping(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void send(input)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Gemini Copilot"
        title="AI Agriculture Assistant"
        description="Multi-turn farm copilot grounded with Google Search and aware of your plots, crop cases, storage alerts, and mandi watchlist."
        badge={
          <Badge tone="forest">
            {mode === 'grounded' ? 'Gemini 4 Hydrogen · Search Grounded' : 'Gemini 3.1 Flash Lite · Fast'}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex shrink-0 rounded-xl border border-line bg-white p-1">
              <button
                type="button"
                onClick={() => setMode('grounded')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mode === 'grounded' ? 'bg-forest text-white' : 'text-muted hover:text-ink'
                }`}
              >
                <Globe size={13} /> Grounded Search
              </button>
              <button
                type="button"
                onClick={() => setMode('fast')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mode === 'fast' ? 'bg-forest text-white' : 'text-muted hover:text-ink'
                }`}
              >
                <Zap size={13} /> Fast Mode
              </button>
            </div>
            <Button variant="outline" onClick={startNewChat} className="whitespace-nowrap">
              <Plus size={14} /> New conversation
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card padded={false} className="flex h-[600px] max-h-[78vh] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line/70 bg-soft-sage/35 px-5 py-4">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-forest text-white">
              <Bot size={19} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-ink">Krishi360 AI Copilot</p>
              <p className="text-[11px] text-muted">
                {mode === 'grounded'
                  ? 'Live Google Search grounding · Dosage safety guard active'
                  : 'Low-latency agronomy Q&A · Dosage safety guard active'}
              </p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-forest">
              <span className="size-2 rounded-full bg-sage" /> Live Gemini
            </span>
          </div>

          <div ref={scrollRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
                    message.sender === 'user' ? 'bg-soft-sage text-forest' : 'bg-forest text-white'
                  }`}
                >
                  {message.sender === 'user' ? <UserRound size={15} /> : <Bot size={15} />}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.sender === 'user' ? 'bg-forest text-white' : 'bg-soft-sage/60 text-ink'
                  }`}
                >
                  {message.safetyFiltered ? (
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      <ShieldAlert size={11} /> Dosage Safety Guard Applied
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>

                  {message.groundingSources && message.groundingSources.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line/50 pt-2">
                      {message.groundingSources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-0.5 text-[10px] font-bold text-forest hover:border-forest"
                        >
                          <span className="max-w-[160px] truncate">{src.title}</span>
                          <ExternalLink size={9} />
                        </a>
                      ))}
                    </div>
                  ) : null}

                  <p className={`mt-2 text-[10px] ${message.sender === 'user' ? 'text-white/60' : 'text-muted'}`}>
                    {message.time}
                    {message.modelUsed ? ` · ${message.modelUsed}` : ''}
                  </p>
                </div>
              </div>
            ))}

            {typing ? (
              <div className="flex gap-3">
                <span className="flex size-8 items-center justify-center rounded-xl bg-forest text-white">
                  <Bot size={15} />
                </span>
                <div className="flex items-center gap-1.5 rounded-2xl bg-soft-sage/60 px-4 py-3">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="size-1.5 animate-bounce rounded-full bg-forest"
                      style={{ animationDelay: `${index * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {lastError ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950">
                <span>{lastError}</span>
                {mode === 'grounded' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('fast')
                      setLastError(null)
                    }}
                    className="shrink-0 rounded-lg bg-amber-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-800"
                  >
                    Switch to Fast Mode
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <form onSubmit={submit} className="flex gap-3 border-t border-line/70 bg-white/50 p-4">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your plots, mandi rates, crop symptoms, or farmer schemes…"
              aria-label="Assistant message"
            />
            <Button type="submit" aria-label="Send message" disabled={!input.trim() || typing}>
              <Send size={17} />
            </Button>
          </form>
        </Card>

        <div className="space-y-5">
          {authProvider === 'firebase' ? (
            <Card>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-forest">
                  <History size={16} />
                  <h2 className="text-sm font-extrabold text-ink">Saved Conversations</h2>
                </div>
                <Badge tone="sage">{sessions.length}</Badge>
              </div>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {loadingSessions ? (
                  <p className="text-xs text-muted">Loading history…</p>
                ) : sessions.length > 0 ? (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                        activeSessionId === s.id
                          ? 'border-forest bg-soft-sage/50 font-bold text-ink'
                          : 'border-line/70 bg-white/70 text-ink hover:border-sage'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectSession(s)}
                        className="flex-1 truncate text-left"
                      >
                        {s.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeSession(s.id)}
                        className="text-muted hover:text-alert"
                        aria-label={`Delete ${s.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted">
                    Ask your first question to save a conversation in Cloud Firestore.
                  </p>
                )}
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="flex items-center gap-2 text-forest">
              <Sparkles size={17} />
              <h2 className="text-sm font-extrabold text-ink">Suggested questions</h2>
            </div>
            <div className="mt-4 space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="w-full rounded-2xl border border-line/70 bg-white/60 px-4 py-3 text-left text-xs font-semibold text-ink transition-colors hover:border-sage hover:bg-soft-sage/40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </Card>

          <Card className="bg-forest text-white">
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-sage uppercase">Safety Policy</p>
            <p className="mt-3 text-xs leading-relaxed text-white/75">
              KRISHI360 AI Copilot never prescribes chemical or pesticide dosages and does not replace qualified agronomists. Consult local experts before field treatments.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
