/** Tiny synthesized UI sounds — no audio files, near-zero weight, generated live. */

let ctx: AudioContext | null = null
const ac = () => (ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)())

function tone(freq: number, start: number, dur: number, vol = 0.08, type: OscillatorType = 'sine') {
  const a = ac()
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, a.currentTime + start)
  g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + start)
  o.stop(a.currentTime + start + dur + 0.05)
}

export type SoundName = 'pop' | 'tick' | 'chime' | 'fanfare' | 'whoosh'

export function play(name: SoundName, enabled: boolean) {
  if (!enabled) return
  try {
    switch (name) {
      case 'pop': // capture saved
        tone(520, 0, 0.09, 0.07, 'triangle')
        tone(780, 0.05, 0.08, 0.05, 'triangle')
        break
      case 'tick': // action done
        tone(1180, 0, 0.06, 0.06, 'sine')
        break
      case 'chime': // block completed
        tone(660, 0, 0.14, 0.07)
        tone(880, 0.09, 0.16, 0.07)
        break
      case 'fanfare': // celebrations
        tone(523, 0, 0.16, 0.08)
        tone(659, 0.12, 0.16, 0.08)
        tone(784, 0.24, 0.18, 0.08)
        tone(1046, 0.38, 0.3, 0.09)
        break
      case 'whoosh': // undo
        tone(400, 0, 0.12, 0.05, 'sawtooth')
        break
    }
  } catch { /* audio not available — never break the app over a sound */ }
}
