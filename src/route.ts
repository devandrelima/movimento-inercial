import {traversable,type Room} from './room'
import type {Point} from './tracker'

// The planned route keeps a geometric clearance, not a guarantee of bodily safety.
export const ROUTE_CLEARANCE=0.2
const MIN_STEP=0.25
/** Limite de células do A*: acima disso a grade fica mais grossa para a rota não travar a página (500 × 500 m a 25 cm seriam 4 milhões de células, ~12 s). */
const MAX_CELLS=160000
/** Resolução da grade: 25 cm até ~100 × 100 m; maior que isso, o menor passo (múltiplo de 5 cm) que respeita o limite de células. */
export function routeStep(room:Room):number {
 const needed=Math.sqrt(Math.max(room.width*room.height,1)/MAX_CELLS)
 return Math.max(MIN_STEP,Math.ceil(needed/0.05-1e-9)*0.05)
}
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
export function routeRoom(room:Room):Room {
 const m=ROUTE_CLEARANCE
 return {...room,width:room.width-2*m,height:room.height-2*m,start:{x:room.start.x-m,y:room.start.y-m},obstacles:room.obstacles.map(o=>({...o,x:o.x-2*m,y:o.y-2*m,width:o.width+2*m,height:o.height+2*m}))}
}
function clearSegment(room:Room,a:Point,b:Point):boolean {
 const m=ROUTE_CLEARANCE
 return traversable(routeRoom(room),{x:a.x-m,y:a.y-m},{x:b.x-m,y:b.y-m})
}
export function clearPoint(room:Room,p:Point):boolean{return clearSegment(room,p,p)}
/** O ponto está dentro da sala e fora dos obstáculos, mesmo que dentro da margem de 20 cm (ex.: origem encostada na parede). */
export function freePoint(room:Room,p:Point):boolean{return traversable(room,p,p)}
/** A* on a grid of `routeStep` (25 cm up to ~100 × 100 m); null means no route found at this resolution and clearance. */
export function planRoute(room:Room,start:Point,goal:Point):Point[]|null {
 // Origem e destino só precisam estar fisicamente livres; a margem vale para o trajeto. Assim uma origem
 // encostada na parede ou um clique perto de um obstáculo ainda geram rota (a perna inicial/final sai da margem).
 if(!freePoint(room,start)||!freePoint(room,goal))return null
 const startClear=clearPoint(room,start),goalClear=clearPoint(room,goal)
 if(startClear&&goalClear&&clearSegment(room,start,goal))return [start,goal]
 const expanded=routeRoom(room),m=ROUTE_CLEARANCE
 const clear=(a:Point,b:Point)=>traversable(expanded,{x:a.x-m,y:a.y-m},{x:b.x-m,y:b.y-m})
 const STEP=routeStep(room)
 const cols=Math.floor(room.width/STEP)+1,rows=Math.floor(room.height/STEP)+1,n=cols*rows
 const point=(i:number):Point=>({x:(i%cols)*STEP,y:Math.floor(i/cols)*STEP})
 // Nós da grade ligados a um extremo. Extremo dentro da margem: liga só a nós com margem e sem cruzar obstáculos.
 const near=(p:Point,pClear:boolean)=>{
  const out:number[]=[];const cx=Math.round(p.x/STEP),cy=Math.round(p.y/STEP)
  for(let y=Math.max(0,cy-2);y<=Math.min(rows-1,cy+2);y++)for(let x=Math.max(0,cx-2);x<=Math.min(cols-1,cx+2);x++){
   const id=y*cols+x,q=point(id);if(pClear?clear(p,q):clearPoint(room,q)&&traversable(room,p,q))out.push(id)
  }
  return out
 }
 const starts=near(start,startClear),ends=new Set(near(goal,goalClear));if(!starts.length||!ends.size)return null
 const cost=new Float64Array(n);cost.fill(Infinity)
 const previous=new Int32Array(n);previous.fill(-1)
 const heap:{id:number;score:number;cost:number}[]=[]
 const push=(item:{id:number;score:number;cost:number})=>{let i=heap.length;heap.push(item);while(i>0){const p=(i-1)>>1;if(heap[p].score<=item.score)break;heap[i]=heap[p];i=p}heap[i]=item}
 const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c}heap[i]=last}return first}
 for(const id of starts){cost[id]=dist(start,point(id));push({id,cost:cost[id],score:cost[id]+dist(point(id),goal)})}
 let finish=-1,best=Infinity
 while(heap.length){
  const node=pop();if(node.cost!==cost[node.id])continue
  if(node.score>=best)break
  if(ends.has(node.id)){const total=node.cost+dist(point(node.id),goal);if(total<best){best=total;finish=node.id}}
  const x=node.id%cols,y=Math.floor(node.id/cols),a=point(node.id)
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue
   const id=ny*cols+nx,b=point(id),next=node.cost+dist(a,b)
   if(next<cost[id]&&clear(a,b)){cost[id]=next;previous[id]=node.id;push({id,cost:next,score:next+dist(b,goal)})}
  }
 }
 if(finish<0)return null
 const reversed:Point[]=[];for(let id=finish;id>=0;id=previous[id])reversed.push(point(id))
 const raw=[start,...reversed.reverse(),goal],out=[start]
 // Remove unnecessary grid corners while preserving full-segment clearance.
 for(let i=0;i<raw.length-1;){let j=raw.length-1;while(j>i+1&&!clear(raw[i],raw[j]))j--;out.push(raw[j]);i=j}
 return out
}
export function distanceToRoute(p:Point,route:Point[]):number {
 let best=Infinity
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy
  const t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0
  best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy))
 }
 return best
}
