import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, Send, Sparkles, UserRound } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useApp } from '../../services/store'
import { useToast } from '../../context/ToastContext'
import type { ChatMessage } from '../../types'

const suggestions = [
  'What should I check before irrigating wheat?',
  'How do I prepare a crop health case?',
  'Which storage batch needs attention?',
  'How can I compare mandi prices?',
]

function answerFor(text: string, criticalBatches: number, cases: number): string {
  const query = text.toLowerCase()
  if (query.includes('irrigat') || query.includes('water')) {
    return 'In this demo, open JalSense and enter your plot, crop stage, soil type and simulated moisture. The recommendation explains its reasoning. Always verify field conditions locally before irrigating.'
  }
  if (query.includes('case') || query.includes('disease') || query.includes('leaf')) {
    return `You currently have ${cases} demo crop case${cases === 1 ? '' : 's'}. In CropDoctor AI, upload a clear image, choose the crop and plant part, add symptoms, then review the labelled simulation. Submitting creates a case for expert review.`
  }
  if (query.includes('storage') || query.includes('batch') || query.includes('humidity')) {
    return criticalBatches > 0
      ? `GrainGuard shows ${criticalBatches} batch above a demo threshold. Open the batch to inspect simulated temperature, humidity and log an inspection. These are not real sensor readings.`
      : 'All demo batches are currently within their configured thresholds. You can still create a batch and test how changing values affects its status.'
  }
  if (query.includes('mandi') || query.includes('price') || query.includes('market')) {
    return 'MandiSmart lets you filter demo prices by crop, state and district, compare modal prices and estimate revenue after a transport cost. Price records are sample data, not live market quotes.'
  }
  if (query.includes('scheme') || query.includes('government')) {
    return 'SchemeSaathi contains sample scheme entries with source links. Check official government portals for current eligibility, documents and terms before applying.'
  }
  return 'I can help you navigate the five demo modules, explain a simulated result or point you to the right portal. Try one of the suggested questions above.'
}

export function AssistantPage() {
  const { storageBatches, cases } = useApp()
  const { show } = useToast()
  const criticalBatches = storageBatches.filter((batch) => batch.status === 'critical').length
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am the KRISHI360 AI demo assistant. I can explain module results and help you navigate this frontend. I do not provide verified diagnoses or live data.',
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const send = (text: string) => {
    const clean = text.trim()
    if (!clean) return
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    setMessages((current) => [...current, { id: `u-${Date.now()}`, sender: 'user', text: clean, time }])
    setInput('')
    setTyping(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: answerFor(clean, criticalBatches, cases.length),
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setTyping(false)
    }, 750)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send(input)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title="AI Agriculture Assistant"
        description="A guided demo conversation built on the same simulated data used across the platform."
        badge={<DemoNote label="Rule-based demo replies" />}
        actions={<Button variant="outline" onClick={() => { setMessages((current) => [current[0]]); show('Conversation cleared', 'A fresh demo chat is ready.', 'info') }}>New conversation</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card padded={false} className="flex h-[560px] max-h-[75vh] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line/70 bg-soft-sage/35 px-5 py-4">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-forest text-white"><Bot size={19} /></span>
            <div>
              <p className="text-sm font-extrabold text-ink">Krishi Assistant</p>
              <p className="text-[11px] text-muted">Demo mode · Answers generated from local rules</p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-forest"><span className="size-2 rounded-full bg-sage" /> Online</span>
          </div>

          <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${message.sender === 'user' ? 'bg-soft-sage text-forest' : 'bg-forest text-white'}`}>
                  {message.sender === 'user' ? <UserRound size={15} /> : <Bot size={15} />}
                </span>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.sender === 'user' ? 'bg-forest text-white' : 'bg-soft-sage/60 text-ink'}`}>
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <p className={`mt-2 text-[10px] ${message.sender === 'user' ? 'text-white/60' : 'text-muted'}`}>{message.time}</p>
                </div>
              </div>
            ))}
            {typing ? (
              <div className="flex gap-3">
                <span className="flex size-8 items-center justify-center rounded-xl bg-forest text-white"><Bot size={15} /></span>
                <div className="flex items-center gap-1.5 rounded-2xl bg-soft-sage/60 px-4 py-3">
                  {[0, 1, 2].map((index) => <span key={index} className="size-1.5 animate-bounce rounded-full bg-forest" style={{ animationDelay: `${index * 120}ms` }} />)}
                </div>
              </div>
            ) : null}
          </div>

          <form onSubmit={submit} className="flex gap-3 border-t border-line/70 bg-white/50 p-4">
            <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about a module or demo result…" aria-label="Assistant message" />
            <Button type="submit" aria-label="Send message" disabled={!input.trim() || typing}><Send size={17} /></Button>
          </form>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-2 text-forest"><Sparkles size={17} /><h2 className="text-sm font-extrabold text-ink">Suggested questions</h2></div>
            <div className="mt-4 space-y-2">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => send(suggestion)} className="w-full rounded-2xl border border-line/70 bg-white/60 px-4 py-3 text-left text-xs font-semibold text-ink transition-colors hover:border-sage hover:bg-soft-sage/40">
                  {suggestion}
                </button>
              ))}
            </div>
          </Card>
          <Card className="bg-forest text-white">
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-sage uppercase">Important</p>
            <p className="mt-3 text-xs leading-relaxed text-white/75">
              This assistant does not provide verified diagnosis, pesticide dosages, live prices or real sensor interpretation. Consult qualified local experts for field decisions.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
