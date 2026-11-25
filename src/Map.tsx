import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Offset = { x: number; y: number }
type Drag = { id: number; x: number; y: number; origin: Offset }

export default function Map({ resetKey }: { resetKey: number }) {
  const map = useRef<HTMLElement>(null)
  const offset = useRef<Offset>({ x: 0, y: 0 })
  const drag = useRef<Drag | null>(null)
  const [panned, setPanned] = useState(false)

  function moveTo(next: Offset) {
    offset.current = next
    map.current?.style.setProperty('--pan-x', `${next.x}px`)
    map.current?.style.setProperty('--pan-y', `${next.y}px`)
    setPanned(next.x !== 0 || next.y !== 0)
  }
  useEffect(() => { drag.current = null; moveTo({x: 0, y: 0}) }, [resetKey])

  function start(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return
    drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY, origin: {...offset.current}}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    moveTo({x: current.origin.x + event.clientX - current.x, y: current.origin.y + event.clientY - current.y})
  }
  function end(event: PointerEvent<HTMLElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return
    const direction: Record<string, Offset> = {ArrowLeft:{x:48,y:0}, ArrowRight:{x:-48,y:0}, ArrowUp:{x:0,y:48}, ArrowDown:{x:0,y:-48}}
    const delta=direction[event.key]
    if (delta) { event.preventDefault(); moveTo({x:offset.current.x+delta.x,y:offset.current.y+delta.y}) }
  }
  return <section ref={map} className="field" role="region" tabIndex={0} aria-label="Plano de trajetória. Arraste para navegar ou use as setas do teclado." onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={keyboard}>
    <div className="field-top"><span>Plano de trajetória</span><span>Grade: 1 m × 1 m</span></div>
    {panned && <button className="center-map" onPointerDown={event => event.stopPropagation()} onClick={() => moveTo({x:0,y:0})}>Centralizar</button>}
    <div className="crosshair"><div className="origin"/><span>Origem</span></div>
    <div className="field-foot"><span>X →</span><span>Y ↑</span></div>
    <p className="model-note">Trajetória disponível após validação do modelo.</p>
  </section>
}
