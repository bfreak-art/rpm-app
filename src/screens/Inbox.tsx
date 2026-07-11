import { useState } from 'react'
import { useStore, live, blockTotals } from '../store/store'
import { HelpButton } from '../components/ui'
import { NewBlockModal } from '../components/capture'
import { dayKey, weekKey } from '../lib/utils'
import { CaptureItem, ID } from '../lib/types'

const HELP = `Chunking turns more into less.

Look at your Capture list and ask: which items relate to the same Result? Group them — a dozen items usually collapse into 3–4 Blocks.

Tap an item to select it (or drag it on desktop), then drop it on a Block. Anything that serves no Result you care about: dismiss it without guilt.`

export default function Inbox() {
  const db = useStore(s => s.db)
  const chunkCapture = useStore(s => s.chunkCapture)
  const markChunked = useStore(s => s.markChunked)
  const dismissCapture = useStore(s => s.dismissCapture)
  const setToast = useStore(s => s.setToast)
  const [selected, setSelected] = useState<ID[]>([])
  const [newBlock, setNewBlock] = useState(false)

  const unsorted = live(db.captures).filter(c => c.status === 'unsorted').sort((a, b) => b.createdAt - a.createdAt)
  const targets = live(db.blocks)
    .filter(b => b.status !== 'completed' &&
      ((b.scope === 'daily' && b.periodDate === dayKey()) || (b.scope === 'weekly' && b.periodDate === weekKey()) || b.scope === 'project'))

  const toggle = (id: ID) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const assign = (blockId: ID) => {
    const n = selected.length
    selected.forEach(id => chunkCapture(id, blockId))
    setSelected([])
    const b = db.blocks[blockId]
    setToast(`✓ ${n} item${n > 1 ? 's' : ''} added to \u201C${b?.result ?? 'Block'}\u201D`)
  }

  const Item = ({ c }: { c: CaptureItem }) => (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', c.id)}
      onClick={() => toggle(c.id)}
      className={`flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer select-none border
        ${selected.includes(c.id) ? 'border-signal bg-signal-soft dark:bg-signal/20' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
    >
      <span className="text-[10px] uppercase font-semibold text-ink-mute w-10 shrink-0">{c.lane === 'comm' ? 'Comm' : 'Idea'}</span>
      <span className="flex-1">{c.text}</span>
      <button className="text-ink-mute text-xs px-1" title="Dismiss" onClick={e => { e.stopPropagation(); dismissCapture(c.id) }}>✕</button>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="h-display text-4xl">Inbox <span className="text-ink-mute text-2xl">{unsorted.length}</span></h1>
        <HelpButton text={HELP} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-3" data-tour="inbox-list">
          <p className="label">Unsorted capture</p>
          {unsorted.length === 0 && <p className="text-sm text-ink-mute p-2">Empty head, clear mind. Press ＋ (or C) to capture anytime.</p>}
          {unsorted.map(c => <Item key={c.id} c={c} />)}
        </div>

        <div className="flex flex-col gap-2" data-tour="chunk-targets">
          <p className="label px-1">Chunk into a Result {selected.length > 0 && <span className="text-signal">— {selected.length} selected, tap a target</span>}</p>
          {targets.map(b => {
            const cat = b.categoryId ? db.categories[b.categoryId] : undefined
            const t = blockTotals(db, b.id)
            return (
              <button key={b.id}
                onClick={() => selected.length && assign(b.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { chunkCapture(id, b.id); setToast(`✓ Added to \u201C${b.result}\u201D`) } }}
                className={`card p-3 text-left border-l-4 text-sm ${selected.length ? 'ring-2 ring-signal/30' : ''}`}
                style={{ borderLeftColor: cat?.color ?? '#5A6B85' }}>
                <span className="flex items-start justify-between gap-2">
                  <span className="h-display text-lg block leading-tight">{b.result}</span>
                  <span key={t.count} className="animate-pop shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5"
                    style={{ background: `${cat?.color ?? '#5A6B85'}22`, color: cat?.color ?? '#5A6B85' }}>
                    {t.count} action{t.count === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="text-[11px] text-ink-mute">{b.scope === 'project' ? 'Project Key Result' : b.scope === 'weekly' ? 'This week' : 'Today'}{cat ? ` · ${cat.juicyName || cat.name}` : ''}</span>
              </button>
            )
          })}
          <button
            onClick={() => setNewBlock(true)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { setSelected([id]); setNewBlock(true) } }}
            className="p-3 rounded-xl border-2 border-dashed border-black/20 dark:border-white/25 text-sm text-ink-mute hover:border-signal hover:text-signal">
            ＋ New Block from {selected.length ? `${selected.length} item${selected.length > 1 ? 's' : ''}` : 'scratch'}
          </button>
        </div>
      </div>

      <NewBlockModal open={newBlock} onClose={() => setNewBlock(false)}
        prefillActions={selected.map(id => db.captures[id]?.text).filter(Boolean) as string[]}
        onCreated={b => { selected.forEach(id => markChunked(id, b.id)); setSelected([]); setToast(`✓ Block created with ${selected.length || 'your'} action${selected.length === 1 ? '' : 's'}`) }} />
    </div>
  )
}
