import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type {Segment} from './tracker'
import {alignForward,zoomOffset} from './map-geometry'

type Point = { x: number; y: number }
type Gesture = {scale:number;offset:Point;center:Point;distance:number}
const MIN_SCALE=12,MAX_SCALE=192,INITIAL_SCALE=48
const clamp=(value:number)=>Math.max(MIN_SCALE,Math.min(MAX_SCALE,value))

export default function Map({ resetKey, segments }: { resetKey: number; segments: Segment[] }) {
  const map = useRef<HTMLElement>(null)
  const offset = useRef<Point>({x:0,y:0})
  const scale = useRef(INITIAL_SCALE)
  const pointers=useRef(new globalThis.Map<number,Point>())
  const gesture=useRef<Gesture|null>(null)
  const [panned,setPanned]=useState(false)
  const [pixelsPerMeter,setPixelsPerMeter]=useState(INITIAL_SCALE)
  const aligned=segments.map(segment=>({id:segment.id,points:alignForward(segment.points)}))
  const awaiting=segments.length===0 || aligned[aligned.length-1].points===null

  function moveTo(next: Point) {
    offset.current=next
    map.current?.style.setProperty('--pan-x', `${next.x}px`)
    map.current?.style.setProperty('--pan-y', `${next.y}px`)
    setPanned(next.x!==0 || next.y!==0)
  }
  function setZoom(next:number,anchor:Point={x:0,y:0}) {
    const value=clamp(next),ratio=value/scale.current
    moveTo(zoomOffset(offset.current,anchor,ratio));scale.current=value;setPixelsPerMeter(value)
  }
  function relative(clientX:number,clientY:number):Point {
    const r=map.current!.getBoundingClientRect()
    return {x:clientX-r.left-r.width/2,y:clientY-r.top-r.height/2}
  }
  useEffect(()=>{
    const element=map.current!
    const wheel=(event:WheelEvent)=>{event.preventDefault();setZoom(scale.current*Math.exp(-event.deltaY*0.002),relative(event.clientX,event.clientY))}
    element.addEventListener('wheel',wheel,{passive:false})
    return ()=>element.removeEventListener('wheel',wheel)
  },[])
  useEffect(()=>{pointers.current.clear();gesture.current=null;moveTo({x:0,y:0});scale.current=INITIAL_SCALE;setPixelsPerMeter(INITIAL_SCALE)},[resetKey])
  function beginGesture() {
    const points=[...pointers.current.values()]
    if(!points.length){gesture.current=null;return}
    const center=points.length>1?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0]
    const distance=points.length>1?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0
    gesture.current={scale:scale.current,offset:{...offset.current},center,distance}
  }
  function start(event:PointerEvent<HTMLElement>) {
    if(event.pointerType==='mouse' && event.button!==0)return
    if(pointers.current.size>=2)return
    pointers.current.set(event.pointerId,relative(event.clientX,event.clientY));event.currentTarget.setPointerCapture(event.pointerId);beginGesture()
  }
  function move(event:PointerEvent<HTMLElement>) {
    if(!pointers.current.has(event.pointerId))return
    pointers.current.set(event.pointerId,relative(event.clientX,event.clientY))
    const initial=gesture.current,points=[...pointers.current.values()]
    if(!initial)return
    if(points.length===1){moveTo({x:initial.offset.x+points[0].x-initial.center.x,y:initial.offset.y+points[0].y-initial.center.y});return}
    if(initial.distance<=0)return
    const center={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}
    const value=clamp(initial.scale*Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)/initial.distance),ratio=value/initial.scale
    const adjusted=zoomOffset(initial.offset,initial.center,ratio)
    moveTo({x:adjusted.x+center.x-initial.center.x,y:adjusted.y+center.y-initial.center.y});scale.current=value;setPixelsPerMeter(value)
  }
  function end(event:PointerEvent<HTMLElement>) {if(pointers.current.delete(event.pointerId))beginGesture()}
  function keyboard(event:KeyboardEvent<HTMLElement>) {
    if(event.target!==event.currentTarget)return
    const direction:Record<string,Point>={ArrowLeft:{x:48,y:0},ArrowRight:{x:-48,y:0},ArrowUp:{x:0,y:48},ArrowDown:{x:0,y:-48}}
    const delta=direction[event.key]
    if(delta){event.preventDefault();moveTo({x:offset.current.x+delta.x,y:offset.current.y+delta.y})}
    if(event.key==='+' || event.key==='='){event.preventDefault();setZoom(scale.current*1.25)}
    if(event.key==='-'){event.preventDefault();setZoom(scale.current/1.25)}
  }
  return <section ref={map} className="field" style={{'--grid-size':`${pixelsPerMeter}px`,'--grid-half':`${pixelsPerMeter/2}px`} as React.CSSProperties} role="region" tabIndex={0} aria-label="Plano de trajetória. Arraste para navegar; use os botões ou gesto de pinça para ajustar o zoom." onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={keyboard}>
    <div className="field-top"><span>Plano de trajetória</span><span>Grade: 1 m × 1 m</span></div>
    {panned && <button className="center-map" onPointerDown={event=>event.stopPropagation()} onClick={()=>moveTo({x:0,y:0})}>Centralizar</button>}
    <div className="map-zoom" onPointerDown={event=>event.stopPropagation()} aria-label="Zoom do mapa">
      <button type="button" aria-label="Aumentar zoom" disabled={pixelsPerMeter>=MAX_SCALE} onClick={()=>setZoom(scale.current*1.25)}>+</button>
      <button type="button" aria-label="Diminuir zoom" disabled={pixelsPerMeter<=MIN_SCALE} onClick={()=>setZoom(scale.current/1.25)}>−</button>
    </div>
    <svg className="trajectory-layer" width="1" height="1" role="img" aria-label="Trajetória estimada">
      {aligned.map((segment,index)=>{
        if(!segment.points)return null
        const last=segment.points[segment.points.length-1]
        return <g key={segment.id} opacity={index===aligned.length-1?1:0.35}>
          <polyline points={segment.points.map(point=>`${point.x*pixelsPerMeter},${-point.y*pixelsPerMeter}`).join(' ')} fill="none" stroke="#087a80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          {segment.points.length>1 && <circle cx={last.x*pixelsPerMeter} cy={-last.y*pixelsPerMeter} r="5" fill="#087a80" stroke="white" strokeWidth="2"/>}
        </g>
      })}
    </svg>
    <div className="crosshair"><div className="origin"/><span>Origem</span></div>
    <div className="field-foot"><span>X →</span><span>Y ↑</span></div>
    {awaiting && <p className="model-note">Ao iniciar, caminhe em linha reta para definir a frente.</p>}
  </section>
}
