import type {Point} from './tracker'
import {insideObstacle,MAX_ROOM_SIZE,MIN_ROOM_SIZE,normalizeAngle,roomAngle,type Room} from './room'

/** Pontos de controle de um retângulo: cantos (ne, nw, se, sw) e arestas (n, s, e, w). Y cresce para cima. */
export type HandleDir='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'
export type Rect={x:number;y:number;width:number;height:number}
export type Limits={minX:number;minY:number;maxX:number;maxY:number}

export const RESIZE_STEP=0.05
export const MIN_OBSTACLE=0.1
export const MIN_ROOM=MIN_ROOM_SIZE
export const MAX_ROOM=MAX_ROOM_SIZE

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const clean=(n:number)=>Math.round(n*1e6)/1e6
const snap=(n:number)=>clean(Math.round(n/RESIZE_STEP)*RESIZE_STEP)

/** Move apenas as arestas envolvidas em `dir` para a posição `p`, respeitando limites e tamanho mínimo. */
export function resizeRect(rect:Rect,dir:HandleDir,p:Point,limits:Limits,min=MIN_OBSTACLE):Rect {
 let left=rect.x,right=rect.x+rect.width,bottom=rect.y,top=rect.y+rect.height
 if(dir.includes('w'))left=clamp(snap(p.x),limits.minX,right-min)
 if(dir.includes('e'))right=clamp(snap(p.x),left+min,limits.maxX)
 if(dir.includes('s'))bottom=clamp(snap(p.y),limits.minY,top-min)
 if(dir.includes('n'))top=clamp(snap(p.y),bottom+min,limits.maxY)
 return {x:clean(left),y:clean(bottom),width:clean(right-left),height:clean(top-bottom)}
}

/**
 * Redimensiona a sala por uma aresta ou canto. A sala sempre começa em (0,0); ao mover a aresta
 * esquerda ou inferior, o conteúdo é deslocado e `shift` informa o quanto a nova origem andou no
 * referencial anterior (para a tela manter os objetos parados durante o arraste).
 * A sala não encolhe além dos obstáculos e do ponto inicial, nem passa de 1–500 m.
 */
export function resizeRoom(room:Room,dir:HandleDir,p:Point):{room:Room;shift:Point} {
 const finite=(n:number)=>Number.isFinite(n)
 const xs=[room.start.x,...room.obstacles.flatMap(o=>[o.x,o.x+o.width])].filter(finite)
 const ys=[room.start.y,...room.obstacles.flatMap(o=>[o.y,o.y+o.height])].filter(finite)
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
 let left=0,right=room.width,bottom=0,top=room.height
 if(dir.includes('w'))left=clamp(snap(p.x),right-MAX_ROOM,Math.min(minX,right-MIN_ROOM))
 if(dir.includes('e'))right=clamp(snap(p.x),Math.max(maxX,left+MIN_ROOM),left+MAX_ROOM)
 if(dir.includes('s'))bottom=clamp(snap(p.y),top-MAX_ROOM,Math.min(minY,top-MIN_ROOM))
 if(dir.includes('n'))top=clamp(snap(p.y),Math.max(maxY,bottom+MIN_ROOM),bottom+MAX_ROOM)
 return {
  shift:{x:clean(left),y:clean(bottom)},
  room:{...room,width:clean(right-left),height:clean(top-bottom),
   start:{x:clean(room.start.x-left),y:clean(room.start.y-bottom)},
   obstacles:room.obstacles.map(o=>({...o,x:clean(o.x-left),y:clean(o.y-bottom)}))}
 }
}

export const coversPoint=(rect:Rect,p:Point)=>insideObstacle(p,{id:'',...rect})

/** Janela visível da planta, em metros (Y para cima). */
export type View={x:number;y:number;w:number;h:number}
export type Bounds={l:number;r:number;b:number;t:number}
/** Folga, em pixels, entre a sala e a borda da área de desenho (cabe as alças de controle). */
export const VIEW_PAD=18

/** Janela que ajusta a sala à área de desenho, deixando `pad` pixels livres em volta. */
export function fitView(width:number,height:number,boxW:number,boxH:number,pad=VIEW_PAD):View {
 const room=Math.min(Math.max(1,boxW-2*pad)/width,Math.max(1,boxH-2*pad)/height)
 const m=pad/room
 return {x:-m,y:-m,w:width+2*m,h:height+2*m}
}

/**
 * Afasta a janela (zoom out) quando a sala, com `pad` de folga, passa do que está visível `vis`.
 * Cada chamada percorre a fração `ease` da distância restante, para a escala mudar de forma contínua;
 * `eps` evita reagir a diferenças de arredondamento. Nunca aproxima a janela.
 */
export function growView(view:View,vis:Bounds,room:Bounds,pad:number,ease:number,eps=0):View {
 let l=view.x,r=view.x+view.w,b=view.y,t=view.y+view.h
 if(room.l-pad<vis.l-eps)l+=(room.l-pad-l)*ease
 if(room.r+pad>vis.r+eps)r+=(room.r+pad-r)*ease
 if(room.b-pad<vis.b-eps)b+=(room.b-pad-b)*ease
 if(room.t+pad>vis.t+eps)t+=(room.t+pad-t)*ease
 return {x:l,y:b,w:r-l,h:t-b}
}

// ---------- Resolução do alvo de um toque/clique no editor ----------
// Em vez de depender do elemento SVG "por cima", o alvo é decidido por prioridade, de modo que
// obstáculos pequenos ou encostados na borda continuem fáceis de pegar. Distâncias em pixels de tela.
export type Zone={dir:HandleDir;x0:number;x1:number;y0:number;y1:number}
export type Hit={kind:'handle';target:string;dir:HandleDir}|{kind:'start'}|{kind:'rotate'}|{kind:'obstacle';id:string}|null
export const HIT={handleOut:14,handleIn:10,roomOut:16,roomIn:4,start:14,obstacleTolerance:10,touchScale:1.4,ringBand:9,arrowBand:8}
/** Tamanhos (px) do ponto inicial, da ponta da seta e do anel de rotação; o desenho e o alvo do clique usam os mesmos. */
export function startGeometry(ppu:number):{dot:number;tip:number;ring:number} {
 const dot=Math.min(10,Math.max(7,0.19*ppu))
 return {dot,tip:dot+22,ring:dot+38}
}
const SIGNS:Record<HandleDir,[number,number]>={n:[0,1],s:[0,-1],e:[1,0],w:[-1,0],ne:[1,1],nw:[-1,1],se:[1,-1],sw:[-1,-1]}
/** Cantos antes das arestas: onde as zonas se sobrepõem, o canto vence. */
export const HANDLE_ORDER:HandleDir[]=['ne','nw','se','sw','n','s','e','w']

/** Zonas de agarre em torno de um retângulo (metros): `out` para fora e `inn` para dentro das arestas. */
export function handleZones(rect:Rect,out:number,inn:number):Zone[] {
 const range=(s:number,lo:number,hi:number):[number,number]=>s<0?[lo-out,lo+inn]:s>0?[hi-inn,hi+out]:[lo+inn,hi-inn]
 return HANDLE_ORDER.map(dir=>{
  const [sx,sy]=SIGNS[dir],[x0,x1]=range(sx,rect.x,rect.x+rect.width),[y0,y1]=range(sy,rect.y,rect.y+rect.height)
  return {dir,x0,x1,y0,y1}
 })
}
const inRect=(r:Rect,p:Point)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height
const rectDistance=(r:Rect,p:Point)=>Math.hypot(Math.max(r.x-p.x,0,p.x-(r.x+r.width)),Math.max(r.y-p.y,0,p.y-(r.y+r.height)))

/**
 * Prioridade: (1) alças do obstáculo selecionado; (2) ponto inicial; (3) obstáculo sob o ponteiro (o menor, se
 * sobrepostos) ou, dentro da sala, o mais próximo a poucos pixels; (4) alças da sala, só sem obstáculo selecionado e
 * com a faixa voltada para FORA da sala, para nunca engolir um obstáculo encostado na parede.
 */
export function hitTest(room:Room,p:Point,options:{ppu:number;touch?:boolean;selectedId:string|null;roomActive:boolean;startSelected?:boolean}):Hit {
 const k=options.touch?HIT.touchScale:1,m=(px:number)=>px*k/options.ppu
 const grab=(rect:Rect,outPx:number,inPx:number,target:string):Hit=>{
  const inn=Math.min(inPx*k,Math.min(rect.width,rect.height)*options.ppu/3)/options.ppu
  for(const z of handleZones(rect,m(outPx),inn))if(p.x>=z.x0&&p.x<=z.x1&&p.y>=z.y0&&p.y<=z.y1)return {kind:'handle',target,dir:z.dir}
  return null
 }
 const selected=options.selectedId?room.obstacles.find(o=>o.id===options.selectedId):undefined
 if(selected){const hit=grab(selected,HIT.handleOut,HIT.handleIn,selected.id);if(hit)return hit}
 // Com o ponto inicial selecionado, o anel de rotação (por fora da seta) vem antes de tudo
 const geo=startGeometry(options.ppu)
 if(options.startSelected&&Math.abs(Math.hypot(p.x-room.start.x,p.y-room.start.y)-geo.ring/options.ppu)<=m(HIT.ringBand))return {kind:'rotate'}
 // O ponto inicial inclui a seta: clicar no corpo ou na haste seleciona/move o ponto
 if(Math.hypot(p.x-room.start.x,p.y-room.start.y)<=m(HIT.start))return {kind:'start'}
 {
  const a=roomAngle(room)*Math.PI/180,len=geo.tip/options.ppu,tip={x:room.start.x+Math.sin(a)*len,y:room.start.y+Math.cos(a)*len}
  const sx=tip.x-room.start.x,sy=tip.y-room.start.y,t=Math.max(0,Math.min(1,((p.x-room.start.x)*sx+(p.y-room.start.y)*sy)/(sx*sx+sy*sy)))
  if(Math.hypot(p.x-(room.start.x+sx*t),p.y-(room.start.y+sy*t))<=m(HIT.arrowBand))return {kind:'start'}
 }
 let body:{id:string;area:number}|null=null
 for(const o of room.obstacles)if(inRect(o,p)){const area=o.width*o.height;if(!body||area<=body.area)body={id:o.id,area}}
 if(body)return {kind:'obstacle',id:body.id}
 if(inRect({x:0,y:0,width:room.width,height:room.height},p)){
  let near:{id:string;d:number}|null=null
  for(const o of room.obstacles){const d=rectDistance(o,p);if(d<=m(HIT.obstacleTolerance)&&(!near||d<=near.d))near={id:o.id,d}}
  if(near)return {kind:'obstacle',id:near.id}
 }
 if(options.roomActive)return grab({x:0,y:0,width:room.width,height:room.height},HIT.roomOut,HIT.roomIn,'room')
 return null
}

/**
 * Ângulo (graus, 0 = cima, horário) do ponteiro em torno de `center`. Com `snap`, gruda nos múltiplos de 15° quando
 * está a até 3° deles (facilita acertar 0°, 45°, 90°…). Devolve null se o ponteiro está em cima do centro.
 */
export function angleFromPoint(center:Point,p:Point,snap=true):number|null {
 const dx=p.x-center.x,dy=p.y-center.y
 if(Math.hypot(dx,dy)<1e-9)return null
 const raw=normalizeAngle(Math.atan2(dx,dy)*180/Math.PI)
 if(!snap)return raw
 const near=Math.round(raw/15)*15
 return Math.abs(raw-near)<=3?normalizeAngle(near):raw
}
