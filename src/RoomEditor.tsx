import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react'
import {flushSync} from 'react-dom'
import {DEFAULT_ROOM,facing,insideObstacle,MAX_ROOM_SIZE,roomAngle,validRoom,type Room,type Obstacle} from './room'
import type {Point} from './tracker'
import {fitScaleForRotation,gesturePose,gridStep,rotateVector,wrapAngle} from './map-geometry'
import {angleFromPoint,coversPoint,fitView,growView,hitTest,resizeRect,startGeometry,resizeRoom,VIEW_PAD,type HandleDir,type Hit,type Rect,type View} from './room-edit'
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
 {kind:'start';dx:number;dy:number}|
 {kind:'rotate'})
/** `selected` guarda o id do obstáculo; o ponto inicial (com o controle de rotação) usa este valor reservado. */
const START_ID='__start__'
type Frame=View&{sx:number;sy:number}
const DIRS:{dir:HandleDir;sx:number;sy:number}[]=[{dir:'n',sx:0,sy:1},{dir:'s',sx:0,sy:-1},{dir:'e',sx:1,sy:0},{dir:'w',sx:-1,sy:0},{dir:'ne',sx:1,sy:1},{dir:'nw',sx:-1,sy:1},{dir:'se',sx:1,sy:-1},{dir:'sw',sx:-1,sy:-1}]
const DIR_ANGLE:Record<HandleDir,number>={n:0,ne:45,e:90,se:135,s:180,sw:225,w:270,nw:315}
const SPIN_CURSORS=['ns-resize','nesw-resize','ew-resize','nwse-resize']
/** Cursor de redimensionar de uma alça, considerando o giro da vista (uma aresta vertical girada 90° vira horizontal). */
function cursorFor(dir:HandleDir,spin:number):string {
 const deg=DIR_ANGLE[dir]+spin*180/Math.PI
 return SPIN_CURSORS[(((Math.round(deg/45)%4)+4)%4)]
}
/** Desenha os pontos de controle de um retângulo (tamanhos em pixels de tela, via `ppu`). Quem recebe o toque é `hitTest`. */
function Handles({rect,ppu}:{rect:Rect;ppu:number}) {
 const {x,y,width,height}=rect,u=(px:number)=>px/ppu
 return <g>
  {DIRS.map(({dir,sx,sy})=>{
   const cx=sx<0?x:sx>0?x+width:x+width/2,cy=sy<0?y:sy>0?y+height:y+height/2,corner=sx!==0&&sy!==0
   if(!corner&&(sx===0?width:height)*ppu<48)return null
   const w=corner?u(10):sx===0?u(20):u(6),h=corner?u(10):sy===0?u(20):u(6)
   return <rect key={'v'+dir} x={cx-w/2} y={-cy-h/2} width={w} height={h} rx={corner?u(2):Math.min(w,h)/2} fill="white" stroke="#126c70" strokeWidth={u(1.5)} pointerEvents="none"/>
  })}
 </g>
}
/** Ponto inicial com a seta da frente; selecionado, mostra o anel de rotação com a alça na ponta da seta. */
function StartMarker({x,y,angle,ppu,selected,placing,invalid}:{x:number;y:number;angle:number;ppu:number;selected:boolean;placing:boolean;invalid:boolean}) {
 const u=(px:number)=>px/ppu,geo=startGeometry(ppu),ring=u(geo.ring),teal='#126c70',at=`translate(${x} ${-y}) rotate(${angle})`
 return <g>
  {selected&&<>
   <circle cx={x} cy={-y} r={ring} fill="none" stroke={teal} strokeWidth={u(1.5)} strokeDasharray={`${u(5)} ${u(4)}`} opacity=".75"/>
   <g transform={at}><circle cx="0" cy={-ring} r={u(7.5)} fill="white" stroke={teal} strokeWidth={u(2)}/></g>
  </>}
  {!placing&&<g transform={at}>
   <line x1="0" y1={-u(geo.dot)} x2="0" y2={-u(geo.tip-10)} stroke={teal} strokeWidth={u(3.5)} strokeLinecap="round"/>
   <polygon points={`0,${-u(geo.tip)} ${-u(8)},${-u(geo.tip-14)} ${u(8)},${-u(geo.tip-14)}`} fill={teal} stroke="white" strokeWidth={u(1.5)} strokeLinejoin="round"/>
  </g>}
  <circle cx={x} cy={-y} r={u(geo.dot)} fill={invalid?'#b8453a':teal} stroke="white" strokeWidth={u(2)}/>
 </g>
}
export default function RoomEditor({initial,link,onSave,onPublished,onUnlinked,onCancel}:Props) {
 const [room,setRoom]=useState<Room>(()=>initial?structuredClone(initial):structuredClone(DEFAULT_ROOM))
 const [selected,setSelected]=useState<string|null>(null),[positionMode,setPositionMode]=useState(false),[attempted,setAttempted]=useState(false)
 const [frame,setFrame]=useState<Frame|null>(null)
 const [box,setBox]=useState({w:600,h:400}),[publishing,setPublishing]=useState(false)
 // Giro da vista (radianos, horário na tela): só visual, não altera a sala. A área girada é encolhida para caber inteira.
 const [spin,setSpin]=useState(0)
 const spinRef=useRef(0),spinTween=useRef(0),wrap=useRef<HTMLDivElement>(null),touches=useRef(new Map<number,Point>()),spinGesture=useRef<{angle:number;spin:number}|null>(null)
 const auth=useAuth()
 const svg=useRef<SVGSVGElement>(null),drag=useRef<Gesture|null>(null),frameRef=useRef<Frame|null>(null),pointerRef=useRef<Point|null>(null),lastRoom=useRef<Room|null>(null),lastKey=useRef(''),loop=useRef(0),tween=useRef(0),lastTick=useRef(0)
 const object=room.obstacles.find(o=>o.id===selected)
 const safeWidth=Number.isFinite(room.width)&&room.width>=1?Math.min(room.width,MAX_ROOM_SIZE):8
 const safeHeight=Number.isFinite(room.height)&&room.height>=1?Math.min(room.height,MAX_ROOM_SIZE):6
 // Em repouso a janela ajusta a sala à área de desenho. Ao arrastar uma aresta da sala, ela só se afasta
 // (zoom out contínuo) quando a sala chega ao limite da grade, mantendo a escala estável no resto do gesto.
 const rest:Frame={...fitView(safeWidth,safeHeight,box.w,box.h),sx:0,sy:0}
 const view=frame??rest
 // Tamanho de layout da área de desenho (o getBoundingClientRect mudaria com o giro, o clientWidth não)
 useLayoutEffect(()=>{
  const el=wrap.current;if(!el)return
  const measure=()=>{const w=Math.round(el.clientWidth*100)/100,h=Math.round(el.clientHeight*100)/100;setBox(b=>b.w===w&&b.h===h?b:{w,h})}
  measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect()
 },[])
 const scaleK=fitScaleForRotation(box.w,box.h,spin)
 /** Pixels de tela por metro: escala do viewBox (meet) vezes o encolhimento da vista girada. */
 const ppu=Math.min(box.w/view.w,box.h/view.h)*scaleK
 useEffect(()=>()=>{cancelAnimationFrame(loop.current);cancelAnimationFrame(tween.current);cancelAnimationFrame(spinTween.current)},[])
 // Shift + roda do mouse gira a vista (listener nativo, para poder impedir a rolagem)
 useEffect(()=>{
  const el=wrap.current;if(!el)return
  const wheel=(event:WheelEvent)=>{if(!event.shiftKey)return;event.preventDefault();applySpin(spinRef.current-(event.deltaY||event.deltaX)*0.003,true)}
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)
 })
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
  return toView(event.clientX,event.clientY,view)
 }
 /** Centro da área de desenho na tela (o giro e o encolhimento são em torno dele). */
 function center():Point|null{const r=wrap.current?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null}
 /** Ponto da tela → coordenadas da janela de edição (metros, Y para cima), desfazendo giro e encolhimento. */
 function toView(clientX:number,clientY:number,f:{x:number;y:number;w:number;h:number}):Point|null {
  const c=center();if(!c)return null
  const k=fitScaleForRotation(box.w,box.h,spinRef.current),v=rotateVector({x:(clientX-c.x)/k,y:(clientY-c.y)/k},-spinRef.current)
  const s=Math.min(box.w/f.w,box.h/f.h)
  return {x:f.x+f.w/2+v.x/s,y:f.y+f.h/2-v.y/s}
 }
 function applySpin(next:number,snap=false){
  let value=wrapAngle(next);if(snap&&Math.abs(value)<4*Math.PI/180)value=0
  spinRef.current=value;setSpin(value)
 }
 /** Volta ao norte para cima com uma animação curta. */
 function resetSpin(){
  cancelAnimationFrame(spinTween.current);const from=spinRef.current,t0=performance.now()
  const step=(now:number)=>{const k=Math.min(1,(now-t0)/180),e=1-(1-k)**3;applySpin(k>=1?0:from*(1-e));if(k<1)spinTween.current=requestAnimationFrame(step)}
  spinTween.current=requestAnimationFrame(step)
 }
 const inRoom=(p:Point):Point=>({x:round(clamp(p.x,0,safeWidth)),y:round(clamp(p.y,0,safeHeight))})
 const roomLimits={minX:0,minY:0,maxX:safeWidth,maxY:safeHeight}
 function begin(event:PointerEvent<SVGSVGElement>,gesture:Gesture){drag.current=gesture;event.currentTarget.setPointerCapture(event.pointerId)}
 function down(event:PointerEvent<SVGSVGElement>){
  if(event.pointerType==='mouse'&&event.button!==0)return
  // Segundo dedo (ou Shift com o mouse): gira a vista; qualquer arraste em andamento é encerrado
  const c=center();touches.current.set(event.pointerId,{x:event.clientX,y:event.clientY})
  if(c&&(touches.current.size>=2||(event.shiftKey&&event.pointerType==='mouse'))){
   if(drag.current){const was=drag.current.kind==='room';drag.current=null;if(was){cancelAnimationFrame(loop.current);settle()}}
   cancelAnimationFrame(spinTween.current);event.currentTarget.setPointerCapture(event.pointerId)
   const pts=[...touches.current.values()],angle=pts.length>=2?gesturePose(pts[0],pts[1]).angle:Math.atan2(event.clientY-c.y,event.clientX-c.x)
   spinGesture.current={angle,spin:spinRef.current};return
  }
  const raw=point(event);if(!raw)return
  if(positionMode){update({start:inRoom(raw)});setPositionMode(false);return}
  const pointer=event.pointerId
  const hit=hitTest(hitRoom(),raw,{ppu,touch:event.pointerType==='touch',selectedId:selected,roomActive,startSelected})
  if(!hit){setSelected(null);return}
  if(hit.kind==='rotate'){begin(event,{kind:'rotate',pointer});return}
  if(hit.kind==='start'){setSelected(START_ID);begin(event,{kind:'start',pointer,dx:room.start.x-raw.x,dy:room.start.y-raw.y});return}
  if(hit.kind==='handle'){
   const dir=hit.dir,id=hit.target
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
  const o=room.obstacles.find(item=>item.id===hit.id);if(!o)return
  const p=inRoom(raw);setSelected(o.id);begin(event,{kind:'move',pointer,id:o.id,dx:p.x-o.x,dy:p.y-o.y})
 }
 /** Sala com as medidas já saneadas (campos em edição podem estar vazios ou fora do limite). */
 function hitRoom():Room{return {...room,width:safeWidth,height:safeHeight}}
 /** Sem gesto em andamento, o cursor acompanha o alvo sob o ponteiro (mouse). */
 function hover(event:PointerEvent<SVGSVGElement>){
  if(event.pointerType==='touch'||positionMode)return
  const raw=point(event),el=svg.current;if(!raw||!el)return
  const hit:Hit=hitTest(hitRoom(),raw,{ppu,selectedId:selected,roomActive,startSelected})
  el.style.cursor=!hit?'crosshair':hit.kind==='handle'?cursorFor(hit.dir,spinRef.current):hit.kind==='start'||hit.kind==='rotate'?'grab':'move'
 }
 function move(event:PointerEvent<SVGSVGElement>){
  if(touches.current.has(event.pointerId))touches.current.set(event.pointerId,{x:event.clientX,y:event.clientY})
  const sg=spinGesture.current
  if(sg){
   const pts=[...touches.current.values()],c=center()
   const angle=pts.length>=2?gesturePose(pts[0],pts[1]).angle:c?Math.atan2(event.clientY-c.y,event.clientX-c.x):sg.angle
   applySpin(sg.spin+(angle-sg.angle),true);return
  }
  const g=drag.current,raw=point(event)
  if(!g){hover(event);return}
  if(g.pointer!==event.pointerId||!raw)return
  if(g.kind==='room'){pointerRef.current={x:event.clientX,y:event.clientY};stepRoom();return}
  if(g.kind==='rotate'){
   // O controle externo gira a seta para o ponteiro (gruda a cada 15° quando está perto)
   const angle=angleFromPoint(room.start,raw);if(angle!==null)update(facing(angle));return
  }
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
  const g=drag.current,p=pointerRef.current,f=frameRef.current
  if(!g||g.kind!=='room'||!p||!f)return
  const at=toView(p.x,p.y,f);if(!at)return
  const next=resizeRoom(g.base,g.dir,{x:at.x+g.ox,y:at.y+g.oy})
  // Janela visível, em coordenadas da vista (não depende do giro: o contêiner só é girado/encolhido por fora)
  const s=Math.min(box.w/f.w,box.h/f.h),cx=f.x+f.w/2,cy=f.y+f.h/2
  const vis={l:cx-box.w/(2*s),r:cx+box.w/(2*s),b:cy-box.h/(2*s),t:cy+box.h/(2*s)}
  const bounds={l:next.shift.x,r:next.shift.x+next.room.width,b:next.shift.y,t:next.shift.y+next.room.height}
  const grown=growView(f,vis,bounds,VIEW_PAD/s,ease,1/s),nf:Frame={...grown,sx:next.shift.x,sy:next.shift.y}
  const key=[next.room.width,next.room.height,nf.x,nf.y,nf.w,nf.h,nf.sx,nf.sy].map(n=>Math.round(n*1e6)).join()
  if(key===lastKey.current)return
  lastKey.current=key;lastRoom.current=next.room
  flushSync(()=>{setRoom(next.room);commitFrame(nf)})
 }
 // O afastamento depende do tempo (não da taxa de eventos do ponteiro): ~30% da distância por quadro de 60 Hz.
 function tick(now:number){const dt=lastTick.current?Math.min(64,Math.max(0,now-lastTick.current)):16.7;lastTick.current=now;stepRoom(1-(1-0.3)**(dt/16.7));loop.current=requestAnimationFrame(tick)}
 /** Ao soltar, a janela desliza até o ajuste final da sala em vez de saltar. */
 function settle(){
  const f=frameRef.current,final=lastRoom.current
  if(!f||!final){commitFrame(null);return}
  const goal=fitView(final.width,final.height,box.w,box.h)
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
  function end(event?:PointerEvent<SVGSVGElement>){
  if(event){touches.current.delete(event.pointerId);if(touches.current.size<2)spinGesture.current=null}
  const g=drag.current;drag.current=null
  if(g?.kind!=='room')return
  cancelAnimationFrame(loop.current);settle()
 }
 const u=(px:number)=>px/ppu,tx=view.sx,ty=-view.sy,grid=gridStep(ppu,14)
 const startSelected=selected===START_ID,roomActive=!object&&!startSelected&&!positionMode
 async function startPublish(){
  // O login é pedido antes de abrir a janela de publicação.
  const ok=await auth.run('Para publicar um mapa é preciso entrar com usuário e senha.',async()=>true)
  if(ok)setPublishing(true)
 }
 function save(){setAttempted(true);if(validRoom(room))onSave(room)}
 return <div className="room-page" role="main"><div className="room-editor">
  <header className="room-header"><div><span className="room-kicker">AMBIENTE</span><h1>Editor de sala</h1></div><div className="room-header-actions"><button className="room-ghost" onClick={onCancel}>Cancelar</button><button className="room-save" onClick={save}>Salvar sala</button><button className="room-publish" onClick={startPublish}>Publicar</button></div></header>
  <div className="room-layout"><section className="room-canvas-panel" aria-label="Planta da sala">
   {spin!==0&&<button type="button" className="room-compass" aria-label="Restaurar o norte para cima" onClick={resetSpin}><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g style={{transformOrigin:'12px 12px',transform:`rotate(${spin}rad)`}}><path d="M12 3 L17 13 L12 11 L7 13 Z" fill="#126c70"/><path d="M12 21 L17 13 L12 11 L7 13 Z" fill="#b9cfcd"/></g></svg></button>}
   <div className="room-canvas-wrap"><div ref={wrap} className="room-canvas-rot" style={spin===0?undefined:{transform:`rotate(${spin}rad) scale(${scaleK})`}} onKeyDown={event=>{if(event.key==='[')applySpin(spinRef.current-Math.PI/12,true);else if(event.key===']')applySpin(spinRef.current+Math.PI/12,true);else if(event.key==='0')resetSpin()}} tabIndex={0} aria-label="Planta da sala. Gire com dois dedos, Shift e a roda do mouse, ou as teclas [ e ]."><svg ref={svg} className="room-canvas" viewBox={`${view.x} ${-(view.y+view.h)} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} role="img" aria-label="Planta da sala com obstáculos e posição inicial">
    <defs><pattern id="room-grid" width={grid} height={grid} patternUnits="userSpaceOnUse"><path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="#dbe8e6" strokeWidth={Math.max(.025,u(1))}/></pattern></defs>
    <g transform={`translate(${tx} ${ty})`} pointerEvents="none">
     <rect x="0" y={-safeHeight} width={safeWidth} height={safeHeight} fill="#f8fbfa"/><rect x="0" y={-safeHeight} width={safeWidth} height={safeHeight} fill="url(#room-grid)"/>
     {room.obstacles.map(o=><rect key={o.id} data-obstacle={o.id} x={o.x} y={-o.y-o.height} width={Math.max(0,o.width)} height={Math.max(0,o.height)} fill={selected===o.id?'#a8cac6':'#c6d8d5'} stroke={selected===o.id?'#126c70':'#71918d'} strokeWidth={Math.max(.06,u(1.5))}/>) }
     <rect x="0" y={-safeHeight} width={safeWidth} height={safeHeight} fill="none" stroke={roomActive?'#126c70':'#476f6d'} strokeWidth={Math.max(roomActive?.1:.08,u(roomActive?2.5:2))} pointerEvents="none"/>
     {roomActive&&<Handles rect={{x:0,y:0,width:safeWidth,height:safeHeight}} ppu={ppu}/>}
     {object&&<Handles rect={object} ppu={ppu}/>}
     <StartMarker x={room.start.x} y={room.start.y} angle={roomAngle(room)} ppu={ppu} selected={startSelected} placing={positionMode} invalid={room.obstacles.some(o=>insideObstacle(room.start,o))}/>
    </g>
   </svg></div></div>
   {attempted&&!validRoom(room)&&<p className="room-error room-canvas-error" role="alert">Confira as medidas: sala de 1 a 500 m, obstáculos dentro dela e ponto inicial livre.</p>}
  </section><aside className="room-settings" aria-label="Configuração da sala">
   <div className="room-section"><div className="room-section-title"><h2>Dimensões da sala <span>(metros)</span></h2>{initial&&<button className="room-link room-danger" onClick={()=>{if(window.confirm('Remover a sala e os obstáculos salvos neste dispositivo?'))onSave(null)}}>Remover sala</button>}</div><div className="room-fields two"><NumberField label="Largura" value={room.width} onChange={width=>update({width})}/><NumberField label="Altura" value={room.height} onChange={height=>update({height})}/></div></div>
   <div className="room-section"><div className="room-section-title"><h2>Início da caminhada</h2><button className={`room-link${positionMode?' active':''}`} onClick={()=>{setPositionMode(!positionMode);setSelected(null)}}>Marcar no mapa</button></div><div className="room-fields three"><NumberField label="X (m)" value={room.start.x} onChange={x=>update({start:{...room.start,x}})}/><NumberField label="Y (m)" value={room.start.y} onChange={y=>update({start:{...room.start,y}})}/><NumberField label="Frente (°)" value={Number.isFinite(room.angle??0)?roomAngle(room):NaN} onChange={angle=>Number.isFinite(angle)?update(facing(angle)):update({angle})}/></div></div>
   <div className="room-section"><div className="room-section-title"><h2>Obstáculos <span>({room.obstacles.length}/20)</span></h2><button className="room-link" onClick={addObstacle} disabled={room.obstacles.length>=20}>+ Adicionar</button></div>
    {object ? <><div className="room-fields four"><NumberField label="X" value={object.x} onChange={x=>updateObstacle(object.id,{x})}/><NumberField label="Y" value={object.y} onChange={y=>updateObstacle(object.id,{y})}/><NumberField label="Largura" value={object.width} onChange={width=>updateObstacle(object.id,{width})}/><NumberField label="Altura" value={object.height} onChange={height=>updateObstacle(object.id,{height})}/></div><button className="room-delete" onClick={()=>{setRoom(r=>({...r,obstacles:r.obstacles.filter(o=>o.id!==object.id)}));setSelected(null)}}>Remover selecionado</button></> : <p className="room-empty">{room.obstacles.length?'Selecione um obstáculo na planta.':'Adicione mesas, armários ou outros obstáculos fixos.'}</p>}
   </div>
  </aside></div>
 {publishing&&<PublishDialog room={room} link={link} auth={auth} onPublished={map=>onPublished(room,{id:map.id,name:map.name})} onDeleted={()=>{setPublishing(false);onUnlinked()}} onClose={()=>setPublishing(false)}/>}
 {auth.dialog}
 </div></div>
}
