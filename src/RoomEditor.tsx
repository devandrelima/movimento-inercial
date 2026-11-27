import {useRef,useState,type PointerEvent} from 'react'
import {DEFAULT_ROOM,validRoom,type Heading,type Room,type Obstacle} from './room'
import type {Point} from './tracker'
import './RoomEditor.css'

type Props={initial:Room|null;onSave:(room:Room|null)=>void;onCancel:()=>void}
const round=(n:number)=>Math.round(n*100)/100
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
function NumberField({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) {
 return <label className="room-number"><span>{label}</span><input type="number" step="0.1" value={Number.isFinite(value)?value:''} onChange={event=>onChange(event.target.value===''?NaN:Number(event.target.value))}/></label>
}
export default function RoomEditor({initial,onSave,onCancel}:Props) {
 const [room,setRoom]=useState<Room>(()=>initial?structuredClone(initial):structuredClone(DEFAULT_ROOM))
 const [selected,setSelected]=useState<string|null>(null),[positionMode,setPositionMode]=useState(false),[attempted,setAttempted]=useState(false)
 const svg=useRef<SVGSVGElement>(null),drag=useRef<{id:string;pointer:number;dx:number;dy:number}|null>(null)
 const object=room.obstacles.find(o=>o.id===selected)
 const safeWidth=Number.isFinite(room.width)&&room.width>=1?Math.min(room.width,30):8
 const safeHeight=Number.isFinite(room.height)&&room.height>=1?Math.min(room.height,30):6
 function update(patch:Partial<Room>){setRoom(r=>({...r,...patch}))}
 function updateObstacle(id:string,patch:Partial<Obstacle>){setRoom(r=>({...r,obstacles:r.obstacles.map(o=>o.id===id?{...o,...patch}:o)}))}
 function addObstacle(){
  if(room.obstacles.length>=20)return
  const id=crypto.randomUUID(),width=Math.min(1,safeWidth),height=Math.min(1,safeHeight)
  const o={id,x:round(Math.max(0,(safeWidth-width)/2)),y:round(Math.max(0,(safeHeight-height)/2)),width,height}
  setRoom(r=>({...r,obstacles:[...r.obstacles,o]}));setSelected(id);setPositionMode(false)
 }
 function point(event:PointerEvent<SVGSVGElement>):Point|null {
  const el=svg.current,m=el?.getScreenCTM();if(!el||!m)return null
  const coord=el.createSVGPoint();coord.x=event.clientX;coord.y=event.clientY;const p=coord.matrixTransform(m.inverse())
  return {x:round(clamp(p.x,0,safeWidth)),y:round(clamp(safeHeight-p.y,0,safeHeight))}
 }
 function down(event:PointerEvent<SVGSVGElement>){
  const p=point(event);if(!p)return
  if(positionMode){update({start:p});setPositionMode(false);return}
  const target=(event.target as Element).closest('[data-obstacle]')
  if(!target){setSelected(null);return}
  const id=target.getAttribute('data-obstacle'),o=room.obstacles.find(item=>item.id===id)
  if(!o)return
  setSelected(o.id);drag.current={id:o.id,pointer:event.pointerId,dx:p.x-o.x,dy:p.y-o.y};event.currentTarget.setPointerCapture(event.pointerId)
 }
 function move(event:PointerEvent<SVGSVGElement>){
  const d=drag.current,p=point(event),o=room.obstacles.find(item=>item.id===d?.id)
  if(!d||d.pointer!==event.pointerId||!p||!o)return
  updateObstacle(d.id,{x:round(clamp(p.x-d.dx,0,Math.max(0,safeWidth-o.width))),y:round(clamp(p.y-d.dy,0,Math.max(0,safeHeight-o.height)))})
 }
 function save(){setAttempted(true);if(validRoom(room))onSave(room)}
 return <main className="room-page"><div className="room-editor">
  <header className="room-header"><div><span className="room-kicker">AMBIENTE</span><h1>Editor de sala</h1></div><div className="room-header-actions"><button className="room-ghost" onClick={onCancel}>Cancelar</button><button className="room-save" onClick={save}>Salvar sala</button></div></header>
  <div className="room-layout"><section className="room-canvas-panel" aria-label="Planta da sala">
   <div className="room-canvas-title"><span>Planta em metros</span><span>Toque para selecionar · arraste para mover</span></div>
   <div className="room-canvas-wrap"><svg ref={svg} className="room-canvas" viewBox={`0 0 ${safeWidth} ${safeHeight}`} preserveAspectRatio="xMidYMid meet" onPointerDown={down} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} role="img" aria-label="Planta da sala com obstáculos e posição inicial">
    <defs><pattern id="room-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#dbe8e6" strokeWidth=".025"/></pattern></defs>
    <rect x="0" y="0" width={safeWidth} height={safeHeight} fill="#f8fbfa"/><rect x="0" y="0" width={safeWidth} height={safeHeight} fill="url(#room-grid)"/>
    {room.obstacles.map(o=><rect key={o.id} data-obstacle={o.id} x={o.x} y={safeHeight-o.y-o.height} width={Math.max(0,o.width)} height={Math.max(0,o.height)} fill={selected===o.id?'#a8cac6':'#c6d8d5'} stroke={selected===o.id?'#126c70':'#71918d'} strokeWidth=".06"/>) }
    <circle cx={room.start.x} cy={safeHeight-room.start.y} r=".19" fill="#126c70" stroke="white" strokeWidth=".06" pointerEvents="none"/>
    <rect x="0" y="0" width={safeWidth} height={safeHeight} fill="none" stroke="#476f6d" strokeWidth=".08" pointerEvents="none"/>
   </svg></div>
   <p className="room-canvas-help">{positionMode?'Toque na planta para marcar o ponto inicial.':'● Ponto inicial  ■ Obstáculo'}</p>
  </section><aside className="room-settings" aria-label="Configuração da sala">
   <div className="room-section"><div className="room-section-title"><h2>Dimensões da sala</h2><span>metros</span></div><div className="room-fields two"><NumberField label="Largura" value={room.width} onChange={width=>update({width})}/><NumberField label="Altura" value={room.height} onChange={height=>update({height})}/></div></div>
   <div className="room-section"><div className="room-section-title"><h2>Início da caminhada</h2><button className={`room-link${positionMode?' active':''}`} onClick={()=>{setPositionMode(!positionMode);setSelected(null)}}>Marcar no mapa</button></div><div className="room-fields three"><NumberField label="X (m)" value={room.start.x} onChange={x=>update({start:{...room.start,x}})}/><NumberField label="Y (m)" value={room.start.y} onChange={y=>update({start:{...room.start,y}})}/><label className="room-number"><span>Frente</span><select value={room.heading} onChange={event=>update({heading:event.target.value as Heading})}><option value="up">↑ Cima</option><option value="right">→ Direita</option><option value="down">↓ Baixo</option><option value="left">← Esquerda</option></select></label></div></div>
   <div className="room-section"><div className="room-section-title"><h2>Obstáculos <span>({room.obstacles.length}/20)</span></h2><button className="room-link" onClick={addObstacle} disabled={room.obstacles.length>=20}>+ Adicionar</button></div>
    {object ? <><div className="room-fields four"><NumberField label="X" value={object.x} onChange={x=>updateObstacle(object.id,{x})}/><NumberField label="Y" value={object.y} onChange={y=>updateObstacle(object.id,{y})}/><NumberField label="Largura" value={object.width} onChange={width=>updateObstacle(object.id,{width})}/><NumberField label="Altura" value={object.height} onChange={height=>updateObstacle(object.id,{height})}/></div><button className="room-delete" onClick={()=>{setRoom(r=>({...r,obstacles:r.obstacles.filter(o=>o.id!==object.id)}));setSelected(null)}}>Remover selecionado</button></> : <p className="room-empty">{room.obstacles.length?'Selecione um obstáculo na planta.':'Adicione mesas, armários ou outros obstáculos fixos.'}</p>}
   </div>
   {attempted&&!validRoom(room)&&<p className="room-error" role="alert">Confira as medidas: sala de 1 a 30 m, obstáculos dentro dela e ponto inicial livre.</p>}
   {initial&&<button className="room-remove" onClick={()=>{if(window.confirm('Remover a sala e os obstáculos salvos neste dispositivo?'))onSave(null)}}>Remover sala</button>}
  </aside></div>
 </div></main>
}
