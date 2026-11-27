import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type {Segment} from './tracker'
import {alignForward,zoomOffset} from './map-geometry'
import {roomVector,type Room} from './room'
import type {MatchedPath} from './map-match'

type Point = { x: number; y: number }
type Gesture = {scale:number;offset:Point;center:Point;distance:number}
const MIN_SCALE=12,MAX_SCALE=192,INITIAL_SCALE=48
const clamp=(value:number)=>Math.max(MIN_SCALE,Math.min(MAX_SCALE,value))

export default function Map({ resetKey, segments, room, matched, onEditRoom, locked }: { resetKey:number;segments:Segment[];room:Room|null;matched:MatchedPath|null;onEditRoom:()=>void;locked:boolean }) {
  const map = useRef<HTMLElement>(null)
  const offset = useRef<Point>({x:0,y:0})
  const scale = useRef(INITIAL_SCALE)
  const pointers=useRef(new globalThis.Map<number,Point>())
  const gesture=useRef<Gesture|null>(null)
  const [panned,setPanned]=useState(false)
  const [pixelsPerMeter,setPixelsPerMeter]=useState(INITIAL_SCALE)
  const [view,setView]=useState<'corrected'|'raw'>('corrected')
  const [notice,setNotice]=useState(false)
  const aligned=room ? [{id:1,points:(view==='raw'?matched?.raw:matched?.corrected)?.map(p=>({x:p.x-room.start.x,y:p.y-room.start.y}))??null}] : segments.map(segment=>({id:segment.id,points:alignForward(segment.points)}))
  const awaiting=segments.length===0 || aligned[aligned.length-1].points===null || aligned[aligned.length-1].points?.length===0
  function exportPaths() {
    if(!matched?.raw.length)return
    const rows=['amostra,x_original_m,y_original_m,x_mapa_m,y_mapa_m']
    matched.raw.forEach((p,index)=>{const c=matched.corrected[index];rows.push([index,p.x,p.y,c?.x??'',c?.y??''].join(','))})
    const url=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv;charset=utf-8'}))
    const link=document.createElement('a');link.href=url;link.download='trajetorias.csv';link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  }

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
  useEffect(()=>{pointers.current.clear();gesture.current=null;moveTo({x:0,y:0});scale.current=INITIAL_SCALE;setPixelsPerMeter(INITIAL_SCALE);setNotice(false)},[resetKey])
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
    <div className="room-map-actions" onPointerDown={event=>event.stopPropagation()}>
      <button onClick={()=>{if(locked){setNotice(true);return}setNotice(false);onEditRoom()}}>{room?'Editar sala':'Criar sala'}</button>
      {room && <button onClick={()=>setView(value=>value==='corrected'?'raw':'corrected')} aria-label={view==='corrected'?'Ver trajetória original':'Ver trajetória com mapa'}>{view==='corrected'?'Ver original':'Ver com mapa'}</button>}
      {room && matched?.raw.length ? <button onClick={exportPaths} aria-label="Baixar trajetórias em CSV">CSV</button> : null}
    </div>
    {panned && <button className="center-map" onPointerDown={event=>event.stopPropagation()} onClick={()=>moveTo({x:0,y:0})}>Centralizar</button>}
    <div className="map-zoom" onPointerDown={event=>event.stopPropagation()} aria-label="Zoom do mapa">
      <button type="button" aria-label="Aumentar zoom" disabled={pixelsPerMeter>=MAX_SCALE} onClick={()=>setZoom(scale.current*1.25)}>+</button>
      <button type="button" aria-label="Diminuir zoom" disabled={pixelsPerMeter<=MIN_SCALE} onClick={()=>setZoom(scale.current/1.25)}>−</button>
    </div>
    <svg className="trajectory-layer" width="1" height="1" role="img" aria-label="Trajetória estimada">
      <defs><marker id="room-direction-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#568b83"/></marker></defs>
      {room && <g aria-label="Sala e obstáculos"><rect x={-room.start.x*pixelsPerMeter} y={(room.start.y-room.height)*pixelsPerMeter} width={room.width*pixelsPerMeter} height={room.height*pixelsPerMeter} fill="#eef7f4" fillOpacity=".5" stroke="#608f89" strokeWidth="2"/>{room.obstacles.map(o=><rect key={o.id} x={(o.x-room.start.x)*pixelsPerMeter} y={(room.start.y-o.y-o.height)*pixelsPerMeter} width={o.width*pixelsPerMeter} height={o.height*pixelsPerMeter} fill="#a9c9c5" stroke="#638c87" strokeWidth="1.5"/>)}</g>}
      {room && <line x1="0" y1="0" x2={roomVector({x:0,y:1},room.heading).x*30} y2={-roomVector({x:0,y:1},room.heading).y*30} stroke="#568b83" strokeWidth="2" markerEnd="url(#room-direction-arrow)"/>}
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
    {(notice||awaiting) && <p className="model-note">{notice?'Para editar a sala, primeiro reinicie a sessão.':room?'Ao iniciar, caminhe em linha reta na direção da seta.':'Ao iniciar, caminhe em linha reta para definir a frente.'}</p>}
  </section>
}
