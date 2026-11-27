import type {Point} from './tracker'
import {insideObstacle,type Room} from './room'

/** Pontos de controle de um retângulo: cantos (ne, nw, se, sw) e arestas (n, s, e, w). Y cresce para cima. */
export type HandleDir='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'
export type Rect={x:number;y:number;width:number;height:number}
export type Limits={minX:number;minY:number;maxX:number;maxY:number}

export const RESIZE_STEP=0.05
export const MIN_OBSTACLE=0.1
export const MIN_ROOM=1
export const MAX_ROOM=30

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
 * A sala não encolhe além dos obstáculos e do ponto inicial, nem passa de 1–30 m.
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
