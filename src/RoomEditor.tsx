import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react'
import {flushSync} from 'react-dom'
import {DEFAULT_ROOM,insideObstacle,validRoom,type Heading,type Room,type Obstacle} from './room'
import type {Point} from './tracker'
import {coversPoint,fitView,growView,resizeRect,resizeRoom,VIEW_PAD,type HandleDir,type Rect,type View} from './room-edit'
import {useAuth} from './auth-ui'
import PublishDialog from './PublishDialog'
import type {RoomLink} from './room-link'
import './RoomEditor.css'

type Props={initial:Room|null;link:RoomLink|null;onSave:(room:Room|null)=>void;onPublished:(room:Room,link:RoomLink)=>void;onUnlinked:()=>void;onCancel:()=>void}
const round=(n:number)=>Math.round(n*100)/100
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
function NumberField({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) {
 return <label className="room-number"><span>{label}</span><input type="number" step="0.1" value={Number.isFinite(value)?value:''} onChange={event=>onChange(event.target.value===''?NaN:Number(event.target.value))}/></label>
}
type Gesture={pointer:number}&(
 {kind:'move';id:string;dx:number;dy:number}|
 {kind:'resize';id:string;dir:HandleDir;ox:number;oy:number;base:Rect}|
 {kind:'room';dir:HandleDir;ox:number;oy:number;base:Room}|
 {kind:'start';dx:number;dy:number})
type Frame=View&{sx:number;sy:number}
const DIRS:{dir:HandleDir;sx:number;sy:number}[]=[{dir:'n',sx:0,sy:1},{dir:'s',sx:0,sy:-1},{dir:'e',sx:1,sy:0},{dir:'w',sx:-1,sy:0},{dir:'ne',sx:1,sy:1},{dir:'nw',sx:-1,sy:1},{dir:'se',sx:1,sy:-1},{dir:'sw',sx:-1,sy:-1}]
const CURSOR:Record<HandleDir,string>={n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',ne:'nesw-resize',sw:'nesw-resize',nw:'nwse-resize',se:'nwse-resize'}
const REACH=14,INNER=10
/** Pontos de controle em torno de um retângulo; tamanhos em pixels de tela, convertidos por `ppu` (pixels por metro). */
function Handles({rect,target,ppu}:{rect:Rect;target:string;ppu:number}) {
 const {x,y,width,height}=rect,u=(px:number)=>px/ppu
 const out=u(REACH),inn=u(Math.min(INNER,Math.min(width,height)*ppu/3))
 const range=(s:number,lo:number,hi:number):[number,number]=>s<0?[lo-out,lo+inn]:s>0?[hi-inn,hi+out]:[lo+inn,hi-inn]
 return <g>
  {DIRS.map(({dir,sx,sy})=>{const [x0,x1]=range(sx,x,x+width),[y0,y1]=range(sy,y,y+height);return <rect key={'z'+dir} data-handle={dir} data-target={target} x={x0} y={-y1} width={x1-x0} height={y1-y0} fill="none" pointerEvents="all" style={{cursor:CURSOR[dir]}}/>})}
  {DIRS.map(({dir,sx,sy})=>{
   const cx=sx<0?x:sx>0?x+width:x+width/2,cy=sy<0?y:sy>0?y+height:y+height/2,corner=sx!==0&&sy!==0
   if(!corner&&(sx===0?width:height)*ppu<48)return null
   const w=corner?u(10):sx===0?u(20):u(6),h=corner?u(10):sy===0?u(20):u(6)
   return <rect key={'v'+dir} x={cx-w/2} y={-cy-h/2} width={w} height={h} rx={corner?u(2):Math.min(w,h)/2} fill="white" stroke="#126c70" strokeWidth={u(1.5)} pointerEvents="none"/>
  })}
 </g>
}
export default function RoomEditor({initial,link,onSave,onPublished,onUnlinked,onCancel}:Props) {
 const [room,setRoom]=useState<Room>(()=>initial?structuredClone(initial):structuredClone(DEFAULT_ROOM))
 const [selected,setSelected]=useState<string|null>(null),[positionMode,setPositionMode]=useState(false),[attempted,setAttempted]=useState(false)
 const [frame,setFrame]=useState<Frame|null>(null),[ppu,setPpu]=useState(40),[dragging,setDragging]=useState<Gesture['kind']|null>(null)
 const [box,setBox]=useState({w:600,h:400}),[publishing,setPublishing]=useState(false)
 const auth=useAuth()
 const svg=useRef<SVGSVGElement>(null),drag=useRef<Gesture|null>(null),frameRef=useRef<Frame|null>(null),pointerRef=useRef<Point|null>(null),lastRoom=useRef<Room|null>(null),lastKey=useRef(''),loop=useRef(0),tween=useRef(0),lastTick=useRef(0)
 const object=room.obstacles.find(o=>o.id===selected)
 const safeWidth=Number.isFinite(room.width)&&room.width>=1?Math.min(room.width,30):8
 const safeHeight=Number.isFinite(room.height)&&room.height>=1?Math.min(room.height,30):6
 // Em repouso a janela ajusta a sala à área de desenho. Ao arrastar uma aresta da sala, ela só se afasta
 // (zoom out contínuo) quando a sala chega ao limite da grade, mantendo a escala estável no resto do gesto.
 const rest:Frame={...fitView(safeWidth,safeHeight,box.w,box.h),sx:0,sy:0}
 const view=frame??rest
 useLayoutEffect(()=>{
  const el=svg.current;if(!el)return
  const measure=()=>{
   const r=el.getBoundingClientRect(),w=Math.round(r.width*100)/100,h=Math.round(r.height*100)/100
   setBox(b=>b.w===w&&b.h===h?b:{w,h})
   const m=el.getScreenCTM();if(m&&m.a>0)setPpu(Math.round(m.a*100)/100)
  }
  measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect()
 },[view.x,view.y,view.w,view.h])
 useEffect(()=>()=>{cancelAnimationFrame(loop.current);cancelAnimationFrame(tween.current)},[])
 function commitFrame(next:Frame|null){frameRef.current=next;setFrame(next)}
 function update(patch:Partial<Room>){setRoom(r=>({...r,...patch}))}
 function updateObstacle(id:string,patch:Partial<Obstacle>){setRoom(r=>({...r,obstacles:r.obstacles.map(o=>o.id===id?{...o,...patch}:o)}))}
 function addObstacle(){
  if(room.obstacles.length>=20)return
  const id=crypto.randomUUID(),width=Math.min(1,safeWidth),height=Math.min(1,safeHeight)
  const o={id,x:round(Math.max(0,(safeWidth-width)/2)),y:round(Math.max(0,(safeHeight-height)/2)),width,height}
  setRoom(r=>({...r,obstacles:[...r.obstacles,o]}));setSelected(id);setPositionMode(false)
 }
 /** Coordenadas da janela de edição (metros, Y para cima), sem limitar à sala. */
 function point(event:PointerEvent<SVGSVGElement>):Point|null {
  const el=svg.current,m=el?.getScreenCTM();if(!el||!m)return null
  const coord=el.createSVGPoint();coord.x=event.clientX;coord.y=event.clientY;const p=coord.matrixTransform(m.inverse())
  return {x:p.x,y:-p.y}
 }
 const inRoom=(p:Point):Point=>({x:round(clamp(p.x,0,safeWidth)),y:round(clamp(p.y,0,safeHeight))})
 const roomLimits={minX:0,minY:0,maxX:safeWidth,maxY:safeHeight}
 function begin(event:PointerEvent<SVGSVGElement>,gesture:Gesture){drag.current=gesture;setDragging(gesture.kind);event.currentTarget.setPointerCapture(event.pointerId)}
 function down(event:PointerEvent<SVGSVGElement>){
  if(event.pointerType==='mouse'&&event.button!==0)return
  const raw=point(event);if(!raw)return
  if(positionMode){update({start:inRoom(raw)});setPositionMode(false);return}
  const target=event.target as Element,pointer=event.pointerId
  if(target.closest('[data-start]')){begin(event,{kind:'start',pointer,dx:room.start.x-raw.x,dy:room.start.y-raw.y});return}
  const handle=target.closest('[data-handle]')
  if(handle){
   const dir=handle.getAttribute('data-handle') as HandleDir,id=handle.getAttribute('data-target')
   const edge=(base:Rect)=>({ox:dir.includes('w')?base.x-raw.x:dir.includes('e')?base.x+base.width-raw.x:0,oy:dir.includes('s')?base.y-raw.y:dir.includes('n')?base.y+base.height-raw.y:0})
   if(id==='room'){
    const base={...room,width:safeWidth,height:safeHeight}
    cancelAnimationFrame(tween.current);commitFrame({...(frameRef.current??rest),sx:0,sy:0});lastRoom.current=base;lastKey.current=''
    pointerRef.current={x:event.clientX,y:event.clientY}
    begin(event,{kind:'room',pointer,dir,base,...edge({x:0,y:0,width:safeWidth,height:safeHeight})})
    lastTick.current=0;loop.current=requestAnimationFrame(tick);return
   }
   const o=room.obstacles.find(item=>item.id===id);if(!o)return
   const base={x:o.x,y:o.y,width:o.width,height:o.height};begin(event,{kind:'resize',pointer,id:o.id,dir,base,...edge(base)});return
  }
  const hit=target.closest('[data-obstacle]')
  if(!hit){setSelected(null);return}
  const o=room.obstacles.find(item=>item.id===hit.getAttribute('data-obstacle'));if(!o)return
  const p=inRoom(raw);setSelected(o.id);begin(event,{kind:'move',pointer,id:o.id,dx:p.x-o.x,dy:p.y-o.y})
 }
 function move(event:PointerEvent<SVGSVGElement>){
  const g=drag.current,raw=point(event)
  if(!g||g.pointer!==event.pointerId||!raw)return
  if(g.kind==='room'){pointerRef.current={x:event.clientX,y:event.clientY};stepRoom();return}
  if(g.kind==='start'){
   const p={x:round(clamp(raw.x+g.dx,0,safeWidth)),y:round(clamp(raw.y+g.dy,0,safeHeight))}
   if(!room.obstacles.some(o=>coversPoint(o,p)))update({start:p});return
  }
  const p=inRoom(raw),o=room.obstacles.find(item=>item.id===g.id);if(!o)return
  const next=g.kind==='move'
   ?{x:round(clamp(p.x-g.dx,0,Math.max(0,safeWidth-o.width))),y:round(clamp(p.y-g.dy,0,Math.max(0,safeHeight-o.height))),width:o.width,height:o.height}
   :resizeRect(g.base,g.dir,{x:raw.x+g.ox,y:raw.y+g.oy},roomLimits)
  if(!coversPoint(next,room.start))updateObstacle(g.id,next)
 }

 /** Aplica o ponteiro à sala e afasta a janela se a sala chegou ao limite visível. */
 function stepRoom(ease=0){
  const g=drag.current,el=svg.current,m=el?.getScreenCTM(),p=pointerRef.current,f=frameRef.current
  if(!g||g.kind!=='room'||!el||!m||!p||!f)return
  const next=resizeRoom(g.base,g.dir,{x:(p.x-m.e)/m.a+g.ox,y:-(p.y-m.f)/m.d+g.oy})
  const r=el.getBoundingClientRect()
  const vis={l:(r.left-m.e)/m.a,r:(r.right-m.e)/m.a,b:-(r.bottom-m.f)/m.d,t:-(r.top-m.f)/m.d}
  const bounds={l:next.shift.x,r:next.shift.x+next.room.width,b:next.shift.y,t:next.shift.y+next.room.height}
  const grown=growView(f,vis,bounds,VIEW_PAD/m.a,ease,1/m.a),nf:Frame={...grown,sx:next.shift.x,sy:next.shift.y}
  const key=[next.room.width,next.room.height,nf.x,nf.y,nf.w,nf.h,nf.sx,nf.sy].map(n=>Math.round(n*1e6)).join()
  if(key===lastKey.current)return
  lastKey.current=key;lastRoom.current=next.room
  flushSync(()=>{setRoom(next.room);commitFrame(nf)})
 }
 // O afastamento depende do tempo (não da taxa de eventos do ponteiro): ~30% da distância por quadro de 60 Hz.
 function tick(now:number){const dt=lastTick.current?Math.min(64,Math.max(0,now-lastTick.current)):16.7;lastTick.current=now;stepRoom(1-(1-0.3)**(dt/16.7));loop.current=requestAnimationFrame(tick)}
 /** Ao soltar, a janela desliza até o ajuste final da sala em vez de saltar. */
 function settle(){
  const f=frameRef.current,el=svg.current,final=lastRoom.current
  if(!f||!el||!final){commitFrame(null);return}
  const r=el.getBoundingClientRect(),goal=fitView(final.width,final.height,r.width,r.height)
  const from={x:f.x-f.sx,y:f.y-f.sy,w:f.w,h:f.h},t0=performance.now()
  commitFrame({...from,sx:0,sy:0})
  const run=(now:number)=>{
   const k=Math.min(1,(now-t0)/180),e=1-(1-k)**3
   if(k>=1){commitFrame(null);return}
   commitFrame({x:from.x+(goal.x-from.x)*e,y:from.y+(goal.y-from.y)*e,w:from.w+(goal.w-from.w)*e,h:from.h+(goal.h-from.h)*e,sx:0,sy:0})
   tween.current=requestAnimationFrame(run)
  }
  tween.current=requestAnimationFrame(run)
 }
 function end(){
  const g=drag.current;drag.current=null;setDragging(null)
  if(g?.kind!=='room')return
  cancelAnimationFrame(loop.current);settle()
 }
 const u=(px:number)=>px/ppu,tx=view.sx,ty=-view.sy
 const roomActive=!object&&!positionMode
 async function startPublish(){
  // O login é pedido antes de abrir a janela de publicação.
  const ok=await auth.run('Para publicar um mapa é preciso entrar com usuário e senha.',async()=>true)
  if(ok)setPublishing(true)
 }
 function save(){setAttempted(true);if(validRoom(room))onSave(room)}
 return <div className="room-page" role="main"><div className="room-editor">
  <header className="room-header"><div><span className="room-kicker">AMBIENTE</span><h1>Editor de sala</h1></div><div className="room-header-actions"><button className="room-ghost" onClick={onCancel}>Cancelar</button><button className="room-save" onClick={save}>Salvar sala</button></div></header>
  <div className="room-layout"><section className="room-canvas-panel" aria-label="Planta da sala">
   <div className="room-canvas-title"><span style={{whiteSpace:"nowrap"}}>Planta em metros</span><span className="room-canvas-hint">Arraste cantos e bordas para redimensionar · ● para mudar o início</span><button className="room-link room-publish" onClick={startPublish}>Publicar…</button></div>
   <div className="room-canvas-wrap"><svg ref={svg} className="room-canvas" viewBox={`${view.x} ${-(view.y+view.h)} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} role="img" aria-label="Planta da sala com obstáculos e posição inicial">
    <defs><pattern id="room-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#dbe8e6" strokeWidth=".025"/></pattern></defs>
    <g transform={`translate(${tx} ${ty})`}>
     <rect x="0" y={-safeHeight} width={safeWidth} height={safeHeight} fill="#f8fbfa"/><rect x="0" y={-safeHeight} width={safeWidth} height={safeHeight} fill="url(#room-grid)"/>
     {room.obstacles.map(o=><rect key={o.id} data-obstacle={o.id} x={o.x} y={-o.y-o.height} width={Math.max(0,o.width)} height={Math.max(0,o.height)} fill={selected===o.id?'#a8cac6':'#c6d8d5'} stroke={selected===o.id?'#126c70':'#71918d'} strokeWidth=".06"/>) }
     <rect x="0" y={-safeHeight} width={safeWidth} height={safeHeight} fill="none" stroke={roomActive?'#126c70':'#476f6d'} strokeWidth={roomActive?.1:.08} pointerEvents="none"/>
     {roomActive&&<Handles rect={{x:0,y:0,width:safeWidth,height:safeHeight}} target="room" ppu={ppu}/>}
     {object&&<Handles rect={object} target={object.id} ppu={ppu}/>}
     {!positionMode&&<g data-start="" style={{cursor:dragging==='start'?'grabbing':'grab'}}><circle cx={room.start.x} cy={-room.start.y} r={Math.max(.19,u(7))} fill={room.obstacles.some(o=>insideObstacle(room.start,o))?'#b8453a':'#126c70'} stroke="white" strokeWidth={Math.max(.06,u(2))} pointerEvents="none"/><circle cx={room.start.x} cy={-room.start.y} r={u(18)} fill="none" pointerEvents="all"/></g>}
     {positionMode&&<circle cx={room.start.x} cy={-room.start.y} r={Math.max(.19,u(7))} fill="#126c70" stroke="white" strokeWidth={Math.max(.06,u(2))} pointerEvents="none"/>}
    </g>
   </svg></div>
   {attempted&&!validRoom(room)?<p className="room-error room-canvas-error" role="alert">Confira as medidas: sala de 1 a 30 m, obstáculos dentro dela e ponto inicial livre.</p>:<p className="room-canvas-help">{positionMode?'Toque na planta para marcar o ponto inicial.':'● Início (arraste) · ■ Obstáculo · puxe cantos e bordas'}</p>}
  </section><aside className="room-settings" aria-label="Configuração da sala">
   <div className="room-section"><div className="room-section-title"><h2>Dimensões da sala <span>(metros)</span></h2>{initial&&<button className="room-link room-danger" onClick={()=>{if(window.confirm('Remover a sala e os obstáculos salvos neste dispositivo?'))onSave(null)}}>Remover sala</button>}</div><div className="room-fields two"><NumberField label="Largura" value={room.width} onChange={width=>update({width})}/><NumberField label="Altura" value={room.height} onChange={height=>update({height})}/></div></div>
   <div className="room-section"><div className="room-section-title"><h2>Início da caminhada</h2><button className={`room-link${positionMode?' active':''}`} onClick={()=>{setPositionMode(!positionMode);setSelected(null)}}>Marcar no mapa</button></div><div className="room-fields three"><NumberField label="X (m)" value={room.start.x} onChange={x=>update({start:{...room.start,x}})}/><NumberField label="Y (m)" value={room.start.y} onChange={y=>update({start:{...room.start,y}})}/><label className="room-number"><span>Frente</span><select value={room.heading} onChange={event=>update({heading:event.target.value as Heading})}><option value="up">↑ Cima</option><option value="right">→ Direita</option><option value="down">↓ Baixo</option><option value="left">← Esquerda</option></select></label></div></div>
   <div className="room-section"><div className="room-section-title"><h2>Obstáculos <span>({room.obstacles.length}/20)</span></h2><button className="room-link" onClick={addObstacle} disabled={room.obstacles.length>=20}>+ Adicionar</button></div>
    {object ? <><div className="room-fields four"><NumberField label="X" value={object.x} onChange={x=>updateObstacle(object.id,{x})}/><NumberField label="Y" value={object.y} onChange={y=>updateObstacle(object.id,{y})}/><NumberField label="Largura" value={object.width} onChange={width=>updateObstacle(object.id,{width})}/><NumberField label="Altura" value={object.height} onChange={height=>updateObstacle(object.id,{height})}/></div><button className="room-delete" onClick={()=>{setRoom(r=>({...r,obstacles:r.obstacles.filter(o=>o.id!==object.id)}));setSelected(null)}}>Remover selecionado</button></> : <p className="room-empty">{room.obstacles.length?'Selecione um obstáculo na planta.':'Adicione mesas, armários ou outros obstáculos fixos.'}</p>}
   </div>
  </aside></div>
 {publishing&&<PublishDialog room={room} link={link} auth={auth} onPublished={map=>onPublished(room,{id:map.id,name:map.name})} onDeleted={()=>{setPublishing(false);onUnlinked()}} onClose={()=>setPublishing(false)}/>}
 {auth.dialog}
 </div></div>
}
