import type {Point} from './tracker'
export type Heading='up'|'right'|'down'|'left'
export type Obstacle={id:string;x:number;y:number;width:number;height:number}
export type Room={version:1;width:number;height:number;start:Point;heading:Heading;obstacles:Obstacle[]}
export const DEFAULT_ROOM:Room={version:1,width:8,height:6,start:{x:1,y:1},heading:'up',obstacles:[]}
export const ROOM_STORAGE_KEY='norte-room-v1'
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)
export function validRoom(value:unknown):value is Room {
 if(!value||typeof value!=='object')return false
 const r=value as Room
 if(r.version!==1||!finite(r.width)||!finite(r.height)||r.width<1||r.height<1||r.width>30||r.height>30||!r.start||!finite(r.start.x)||!finite(r.start.y)||!['up','right','down','left'].includes(r.heading)||!Array.isArray(r.obstacles)||r.obstacles.length>20)return false
 if(r.start.x<0||r.start.x>r.width||r.start.y<0||r.start.y>r.height)return false
 const ids=new Set<string>()
 for(const o of r.obstacles){
  if(!o||typeof o.id!=='string'||!o.id||ids.has(o.id)||![o.x,o.y,o.width,o.height].every(finite)||o.width<0.1||o.height<0.1||o.x<0||o.y<0||o.x+o.width>r.width+1e-9||o.y+o.height>r.height+1e-9)return false
  ids.add(o.id)
 }
 return !r.obstacles.some(o=>insideObstacle(r.start,o))
}
export function insideObstacle(p:Point,o:Obstacle):boolean {return p.x>=o.x&&p.x<=o.x+o.width&&p.y>=o.y&&p.y<=o.y+o.height}
export function traversable(room:Room,a:Point,b:Point):boolean {
 if(![a.x,a.y,b.x,b.y].every(Number.isFinite))return false
 if([a,b].some(p=>p.x<0||p.x>room.width||p.y<0||p.y>room.height))return false
 return !room.obstacles.some(o=>intersects(a,b,o))
}
// Liang–Barsky: reject contact with any part of a rectangular obstacle.
function intersects(a:Point,b:Point,o:Obstacle):boolean {
 let lo=0,hi=1
 const dx=b.x-a.x,dy=b.y-a.y
 for(const [p,q] of [[-dx,a.x-o.x],[dx,o.x+o.width-a.x],[-dy,a.y-o.y],[dy,o.y+o.height-a.y]]){
  if(Math.abs(p)<1e-12){if(q<0)return false;continue}
  const t=q/p
  if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t)
  if(lo>hi)return false
 }
 return true
}
/** Rotate the initial-forward frame into the selected room direction. */
export function roomVector(v:Point,heading:Heading):Point {
 switch(heading){case 'up':return {...v};case 'right':return {x:v.y,y:-v.x};case 'down':return {x:-v.x,y:-v.y};case 'left':return {x:-v.y,y:v.x}}
}
export function loadRoom():Room|null {try{const raw=localStorage.getItem(ROOM_STORAGE_KEY);if(!raw)return null;const value:unknown=JSON.parse(raw);return validRoom(value)?value:null}catch{return null}}
