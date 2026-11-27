import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type {Segment} from './tracker'
import {alignInfo,applyGesture,gesturePose,gridStep,headingAngle,initialView,rotateAbout,screenToLayer,wrapAngle,zoomOffset,type GesturePose,type View} from './map-geometry'
import {roomAngle,roomVector,type Room} from './room'
import type {MatchedPath} from './map-match'

type Point = { x: number; y: number }
type Gesture = {view:View;pose:GesturePose;rotate:boolean}
const TAP_SLOP=8
const MIN_SCALE=0.5,MAX_SCALE=192,INITIAL_SCALE=48
const NORTH_SNAP=4*Math.PI/180 // a rotação gruda em "norte para cima" a menos de 4°
const clamp=(value:number)=>Math.max(MIN_SCALE,Math.min(MAX_SCALE,value))

export default function Map({ resetKey, segments, room, matched, goal, route, onPickGoal, onEditRoom, onOpenMaps, locked, limited=false }: { resetKey:number;segments:Segment[];room:Room|null;matched:MatchedPath|null;goal:Point|null;route:Point[]|null;onPickGoal:(point:Point)=>string|null;onEditRoom:()=>void;onOpenMaps:()=>void;locked:boolean;limited?:boolean }) {
  const map = useRef<HTMLElement>(null)
  const offset = useRef<Point>({x:0,y:0})
  const rotation = useRef(0) // radianos, sentido horário
  const [rotated,setRotated]=useState(false)
  const resetTween=useRef(0)
  const scale = useRef(INITIAL_SCALE)
  const pointers=useRef(new globalThis.Map<number,Point>())
  const gesture=useRef<Gesture|null>(null)
  const [pixelsPerMeter,setPixelsPerMeter]=useState(INITIAL_SCALE)
  const [notice,setNotice]=useState<'edit'|'maps'|null>(null)
  const [goalNotice,setGoalNotice]=useState<string|null>(null)
  const tap=useRef<{id:number;x:number;y:number}|null>(null),goalTimer=useRef(0)
  const grid=gridStep(pixelsPerMeter,10)
  const aligned=room ? [{id:1,provisional:matched?.provisional??false,points:matched?.corrected?.map(p=>({x:p.x-room.start.x,y:p.y-room.start.y}))??null}] : segments.map(segment=>{const info=alignInfo(segment.points);return {id:segment.id,provisional:info?!info.final:false,points:info?.points??null}})
  const awaiting=segments.length===0 || aligned[aligned.length-1].points===null || aligned[aligned.length-1].points?.length===0
  function exportPaths() {
    if(!matched?.raw.length)return
    const rows=['amostra,x_original_m,y_original_m,x_mapa_m,y_mapa_m']
    matched.raw.forEach((p,index)=>{const c=matched.corrected[index];rows.push([index,p.x,p.y,c?.x??'',c?.y??''].join(','))})
    const url=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv;charset=utf-8'}))
    const link=document.createElement('a');link.href=url;link.download='trajetorias.csv';link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  }

  /** Aplica deslocamento e rotação ao DOM. A grade é um elemento à parte, centrado na tela e girado, então
   *  precisa da origem no referencial dela: R(-θ)·deslocamento. */
  function applyView() {
    const el=map.current;if(!el)return
    const t=offset.current,th=rotation.current,c=Math.cos(th),s=Math.sin(th)
    el.style.setProperty('--pan-x',`${t.x}px`);el.style.setProperty('--pan-y',`${t.y}px`)
    el.style.setProperty('--rot',`${th*180/Math.PI}deg`)
    el.style.setProperty('--gx',`${c*t.x+s*t.y}px`);el.style.setProperty('--gy',`${-s*t.x+c*t.y}px`)
    setRotated(Math.abs(wrapAngle(th))>0.0005)
  }
  function moveTo(next: Point) {offset.current=next;applyView()}
  function setView(view:View) {
    offset.current=view.offset;rotation.current=view.rotation;scale.current=view.scale;setPixelsPerMeter(view.scale);applyView()
  }
  const currentView=():View=>({scale:scale.current,rotation:rotation.current,offset:{...offset.current}})
  function setZoom(next:number,anchor:Point={x:0,y:0}) {
    const value=clamp(next),ratio=value/scale.current
    offset.current=zoomOffset(offset.current,anchor,ratio);scale.current=value;setPixelsPerMeter(value);applyView()
  }
  function rotateBy(delta:number,pivot:Point={x:0,y:0}) {setView(rotateAbout(currentView(),delta,pivot,NORTH_SNAP))}
  /** Volta ao norte para cima com uma animação curta (o mapa gira em torno do centro). */
  function resetRotation() {
    cancelAnimationFrame(resetTween.current)
    const from=currentView(),start=performance.now()
    const step=(now:number)=>{
      const k=Math.min(1,(now-start)/180),e=1-(1-k)**3
      setView(k>=1?rotateAbout(from,-from.rotation,{x:0,y:0}):rotateAbout(from,-from.rotation*e,{x:0,y:0}))
      if(k<1)resetTween.current=requestAnimationFrame(step)
    }
    resetTween.current=requestAnimationFrame(step)
  }
  function relative(clientX:number,clientY:number):Point {
    const r=map.current!.getBoundingClientRect()
    return {x:clientX-r.left-r.width/2,y:clientY-r.top-r.height/2}
  }
  useEffect(()=>{
    const element=map.current!
    // Roda do mouse: zoom. Com Shift: gira o mapa em torno do cursor.
    const wheel=(event:WheelEvent)=>{
      event.preventDefault()
      if(event.shiftKey){rotateBy(-(event.deltaY||event.deltaX)*0.003,relative(event.clientX,event.clientY));return}
      setZoom(scale.current*Math.exp(-event.deltaY*0.002),relative(event.clientX,event.clientY))
    }
    // Mede a área para a grade (girada) sempre cobrir a tela
    const size=()=>{const r=element.getBoundingClientRect();element.style.setProperty('--grid-d',`${Math.ceil(Math.hypot(r.width,r.height))+8}px`)}
    size();const observer=new ResizeObserver(size);observer.observe(element)
    element.addEventListener('wheel',wheel,{passive:false})
    return ()=>{element.removeEventListener('wheel',wheel);observer.disconnect();cancelAnimationFrame(resetTween.current)}
  },[])
  useEffect(()=>{
    pointers.current.clear();tap.current=null;gesture.current=null;cancelAnimationFrame(resetTween.current);rotation.current=0
    // Sala que não cabe no zoom padrão (até 500 × 500 m): abre afastada e centralizada.
    const box=map.current!.getBoundingClientRect(),view=room?initialView(room,box.width,box.height,INITIAL_SCALE,MIN_SCALE):{scale:INITIAL_SCALE,offset:{x:0,y:0}}
    setView({scale:view.scale,rotation:0,offset:view.offset});setNotice(null)
  },[resetKey])
  function beginGesture(rotateMode=false) {
    const points=[...pointers.current.values()]
    if(!points.length){gesture.current=null;return}
    // Dois dedos: zoom + giro + deslocamento. Um dedo: desloca (ou, com Shift+mouse, gira em torno do centro).
    const pose=points.length>1?gesturePose(points[0],points[1]):{center:points[0],distance:0,angle:Math.atan2(points[0].y,points[0].x)}
    gesture.current={view:currentView(),pose,rotate:rotateMode&&points.length===1}
  }
  function start(event:PointerEvent<HTMLElement>) {
    if(event.pointerType==='mouse' && event.button!==0)return
    if(pointers.current.size>=2)return
    cancelAnimationFrame(resetTween.current)
    pointers.current.set(event.pointerId,relative(event.clientX,event.clientY));event.currentTarget.setPointerCapture(event.pointerId);beginGesture(event.shiftKey&&event.pointerType==='mouse')
    // Um toque (sem arrastar nem pinça) escolhe o destino ao soltar.
    tap.current=pointers.current.size===1&&!event.shiftKey?{id:event.pointerId,x:event.clientX,y:event.clientY}:null
  }
  function move(event:PointerEvent<HTMLElement>) {
    if(!pointers.current.has(event.pointerId))return
    if(tap.current&&(tap.current.id!==event.pointerId||Math.hypot(event.clientX-tap.current.x,event.clientY-tap.current.y)>TAP_SLOP))tap.current=null
    pointers.current.set(event.pointerId,relative(event.clientX,event.clientY))
    const initial=gesture.current,points=[...pointers.current.values()]
    if(!initial)return
    if(points.length===1){
      if(initial.rotate){
        // Shift + arrastar com o mouse: gira em torno do centro, seguindo o ângulo do ponteiro
        const angle=Math.atan2(points[0].y,points[0].x)-initial.pose.angle
        setView(rotateAbout(initial.view,angle,{x:0,y:0},NORTH_SNAP));return
      }
      moveTo({x:initial.view.offset.x+points[0].x-initial.pose.center.x,y:initial.view.offset.y+points[0].y-initial.pose.center.y});return
    }
    if(initial.pose.distance<=0)return
    setView(applyGesture(initial.view,initial.pose,gesturePose(points[0],points[1]),{min:MIN_SCALE,max:MAX_SCALE},NORTH_SNAP))
  }
  function end(event:PointerEvent<HTMLElement>) {if(pointers.current.delete(event.pointerId))beginGesture()}
  function flashGoal(message:string){setGoalNotice(message);window.clearTimeout(goalTimer.current);goalTimer.current=window.setTimeout(()=>setGoalNotice(null),4500)}
  function up(event:PointerEvent<HTMLElement>) {
    const t=tap.current;tap.current=null
    if(t&&t.id===event.pointerId&&room&&!locked){
      const p=relative(event.clientX,event.clientY)
      const layer=screenToLayer(currentView(),p)
      const error=onPickGoal({x:room.start.x+layer.x,y:room.start.y-layer.y})
      if(error)flashGoal(error+(goal?' O destino anterior continua ativo.':''));else {window.clearTimeout(goalTimer.current);setGoalNotice(null)}
    }
    end(event)
  }
  function keyboard(event:KeyboardEvent<HTMLElement>) {
    if(event.target!==event.currentTarget)return
    const direction:Record<string,Point>={ArrowLeft:{x:48,y:0},ArrowRight:{x:-48,y:0},ArrowUp:{x:0,y:48},ArrowDown:{x:0,y:-48}}
    const delta=direction[event.key]
    if(delta){event.preventDefault();moveTo({x:offset.current.x+delta.x,y:offset.current.y+delta.y})}
    if(event.key==='+' || event.key==='='){event.preventDefault();setZoom(scale.current*1.25)}
    if(event.key==='-'){event.preventDefault();setZoom(scale.current/1.25)}
    if(event.key==='['){event.preventDefault();rotateBy(-Math.PI/12)}
    if(event.key===']'){event.preventDefault();rotateBy(Math.PI/12)}
    if(event.key==='0'){event.preventDefault();resetRotation()}
  }
  return <section ref={map} className={`field${rotated?' is-rotated':''}`} data-px-per-m={pixelsPerMeter} style={{'--grid-size':`${pixelsPerMeter*grid}px`,'--grid-half':`${pixelsPerMeter*grid/2}px`} as React.CSSProperties} role="region" tabIndex={0} aria-label="Plano de trajetória. Arraste para navegar; use os botões ou o gesto de pinça para ajustar o zoom e gire o mapa com dois dedos (ou Shift com a roda do mouse, ou as teclas [ e ])." onPointerDown={start} onPointerMove={move} onPointerUp={up} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={keyboard}>
    <div className="field-grid" aria-hidden="true"/>
    <div className="field-top"><span>Plano de trajetória</span><span>Grade: {grid.toLocaleString('pt-BR')} m × {grid.toLocaleString('pt-BR')} m</span></div>
    <div className="room-map-actions" onPointerDown={event=>event.stopPropagation()}>
      <button onClick={()=>{if(locked){setNotice('edit');return}setNotice(null);onEditRoom()}}>{room?'Editar sala':'Criar sala'}</button>
      <button onClick={()=>{if(locked){setNotice('maps');return}setNotice(null);onOpenMaps()}}>Mapas públicos</button>
      {room && matched?.raw.length ? <button onClick={exportPaths} aria-label="Baixar trajetórias em CSV">CSV</button> : null}
    </div>
    <div className="map-zoom" onPointerDown={event=>event.stopPropagation()} aria-label="Zoom do mapa">
      <button type="button" aria-label="Aumentar zoom" disabled={pixelsPerMeter>=MAX_SCALE} onClick={()=>setZoom(scale.current*1.25)}>+</button>
      <button type="button" aria-label="Diminuir zoom" disabled={pixelsPerMeter<=MIN_SCALE} onClick={()=>setZoom(scale.current/1.25)}>−</button>
    </div>
    {rotated && <button type="button" className="map-compass" aria-label="Restaurar o norte para cima" onPointerDown={event=>event.stopPropagation()} onClick={resetRotation}><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g className="compass-needle"><path d="M12 3 L17 13 L12 11 L7 13 Z" fill="#126c70"/><path d="M12 21 L17 13 L12 11 L7 13 Z" fill="#b9cfcd"/></g></svg></button>}
    <div className="map-world">
    <svg className="trajectory-layer" width="1" height="1" role="img" aria-label="Trajetória estimada">
      <defs><marker id="room-direction-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#568b83"/></marker></defs>
      {room && <g aria-label="Sala e obstáculos"><rect x={-room.start.x*pixelsPerMeter} y={(room.start.y-room.height)*pixelsPerMeter} width={room.width*pixelsPerMeter} height={room.height*pixelsPerMeter} fill="#eef7f4" fillOpacity=".5" stroke="#608f89" strokeWidth="2"/>{room.obstacles.map(o=><rect key={o.id} x={(o.x-room.start.x)*pixelsPerMeter} y={(room.start.y-o.y-o.height)*pixelsPerMeter} width={o.width*pixelsPerMeter} height={o.height*pixelsPerMeter} fill="#a9c9c5" stroke="#638c87" strokeWidth="1.5"/>)}</g>}
      {room && route && <polyline aria-label="Rota sugerida" points={route.map(p=>`${(p.x-room.start.x)*pixelsPerMeter},${(room.start.y-p.y)*pixelsPerMeter}`).join(' ')} fill="none" stroke="#9b6921" strokeWidth="2.5" strokeDasharray="7 5"/>}
      {room && goal && <circle aria-label="Destino" cx={(goal.x-room.start.x)*pixelsPerMeter} cy={(room.start.y-goal.y)*pixelsPerMeter} r="6" fill="#9b6921" stroke="white" strokeWidth="2"/>}
      {room && <line x1="0" y1="0" x2={roomVector({x:0,y:1},roomAngle(room)).x*30} y2={-roomVector({x:0,y:1},roomAngle(room)).y*30} stroke="#568b83" strokeWidth="2" markerEnd="url(#room-direction-arrow)"/>}
      {aligned.map((segment,index)=>{
        if(!segment.points)return null
        const last=segment.points[segment.points.length-1],heading=segment.points.length>1?headingAngle(segment.points):null
        // Trecho com a direção ainda provisória (menos de 1 m): mais claro, até a direção ser confirmada
        return <g key={segment.id} opacity={index===aligned.length-1?(segment.provisional?0.55:1):0.35} data-provisional={segment.provisional||undefined}>
          <polyline points={segment.points.map(point=>`${point.x*pixelsPerMeter},${-point.y*pixelsPerMeter}`).join(' ')} fill="none" stroke="#087a80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          {segment.points.length>1 && (heading===null
            ? <circle cx={last.x*pixelsPerMeter} cy={-last.y*pixelsPerMeter} r="5" fill="#087a80" stroke="white" strokeWidth="2"/>
            : <polygon className="trail-arrow" data-heading={heading.toFixed(1)} aria-label="Direção atual" points="12,0 -9,-9.5 -4,0 -9,9.5" transform={`translate(${last.x*pixelsPerMeter} ${-last.y*pixelsPerMeter}) rotate(${heading})`} fill="#087a80" stroke="white" strokeWidth="2" strokeLinejoin="round"/>)}
        </g>
      })}
    </svg>
    </div>
    <div className="crosshair"><div className="origin"/><span>Origem</span></div>
    <div className="field-foot"><span>X →</span><span>Y ↑</span></div>
    {(goalNotice||notice||(awaiting&&!limited)) && <p className="model-note">{goalNotice?goalNotice:notice==='edit'?'Para editar a sala, primeiro reinicie a sessão.':notice==='maps'?'Para trocar o mapa, primeiro reinicie a sessão.':room?'Ao iniciar, caminhe em linha reta na direção da seta.':'Ao iniciar, caminhe em linha reta para definir a frente.'}</p>}
  </section>
}
