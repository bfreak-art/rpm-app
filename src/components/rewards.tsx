import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { play } from '../lib/sound'

/** Floating "+N XP" burst near the bottom of the screen on every XP gain. */
function XpBurst() {
  const burst = useStore(s => s.xpBurst)
  const [visible, setVisible] = useState<{ n: number; id: number } | null>(null)

  useEffect(() => {
    if (!burst) return
    setVisible(burst)
    const t = setTimeout(() => setVisible(v => (v?.id === burst.id ? null : v)), 1400)
    return () => clearTimeout(t)
  }, [burst])

  if (!visible) return null
  return (
    <div key={visible.id}
      className="fixed left-1/2 bottom-36 sm:bottom-20 z-50 pointer-events-none animate-xpfloat">
      <span className="h-display text-3xl text-signal drop-shadow-sm">+{visible.n} XP</span>
    </div>
  )
}

/** Confetti celebration — small for the daily review, big for weekly planning. */
function Celebration() {
  const celebration = useStore(s => s.celebration)
  const setCelebration = useStore(s => s.setCelebration)

  const pieces = useMemo(() => {
    if (!celebration) return []
    const count = celebration === 'week' ? 90 : 40
    const colors = ['#E8563F', '#2E7D6B', '#3B6FB5', '#B5652E', '#7C4DA0', '#F2B441']
    return Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.6 + Math.random() * 1.4,
      size: 6 + Math.random() * 7,
      color: colors[i % colors.length],
      rotate: Math.random() * 360
    }))
  }, [celebration])

  useEffect(() => {
    if (!celebration) return
    play('fanfare', useStore.getState().settings.sounds)
    const t = setTimeout(() => setCelebration(null), celebration === 'week' ? 4200 : 2800)
    return () => clearTimeout(t)
  }, [celebration]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!celebration) return null
  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i} className="absolute top-[-20px] animate-confetti rounded-sm"
          style={{
            left: `${p.left}%`, width: p.size, height: p.size * 0.6,
            background: p.color, transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`
          }} />
      ))}
      <div className="absolute inset-x-0 top-1/3 flex justify-center">
        <div className="animate-pop card px-6 py-4 text-center">
          <p className="h-display text-3xl text-signal">
            {celebration === 'week' ? 'Week planned ✦' : 'Day complete ✦'}
          </p>
          <p className="text-sm text-ink-mute mt-1">
            {celebration === 'week'
              ? 'The cornerstone is in place. This hour will pay you back all week.'
              : 'You showed up, you measured, you celebrated. That\u2019s the whole game.'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Rewards() {
  return (
    <>
      <XpBurst />
      <Celebration />
    </>
  )
}
