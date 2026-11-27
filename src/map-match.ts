import {alignForward} from './map-geometry'
import {roomVector,traversable,type Room} from './room'
import type {Point} from './tracker'

// Experimental, reproducible sampling; noise is heuristic and is not calibrated uncertainty.
export class MapMatcher {
 private particles:Point[]
 private randomState=0x13579bdf
 private output:Point
 private failed=false
 private room:Room
 private count:number
 constructor(room:Room,count=128){this.room=room;this.count=count;this.particles=Array.from({length:count},()=>({...room.start}));this.output={...room.start}}
 private random():number {this.randomState=(Math.imul(1664525,this.randomState)+1013904223)>>>0;return (this.randomState+.5)/4294967296}
 private normal():number {return Math.sqrt(-2*Math.log(this.random()))*Math.cos(2*Math.PI*this.random())}
 step(delta:Point):Point|null {
  if(this.failed)return null
  const distance=Math.hypot(delta.x,delta.y)
  if(!Number.isFinite(distance)){this.failed=true;return null}
  if(distance===0)return {...this.output}
  const sigma=distance*0.2,candidates:Point[]=[]
  for(const p of this.particles){const next={x:p.x+delta.x+this.normal()*sigma,y:p.y+delta.y+this.normal()*sigma};if(traversable(this.room,p,next))candidates.push(next)}
  const reachable=candidates.filter(p=>traversable(this.room,this.output,p))
  if(!reachable.length){this.failed=true;return null}
  const mean=reachable.reduce((acc,p)=>({x:acc.x+p.x/reachable.length,y:acc.y+p.y/reachable.length}),{x:0,y:0})
  const chosen=reachable.reduce((best,p)=>Math.hypot(p.x-mean.x,p.y-mean.y)<Math.hypot(best.x-mean.x,best.y-mean.y)?p:best)
  this.output={...chosen}
  this.particles=Array.from({length:this.count},()=>({...candidates[Math.floor(this.random()*candidates.length)]}))
  return {...this.output}
 }
}
export type MatchedPath={raw:Point[];corrected:Point[];lost:boolean}
/** Incrementally applies one local-to-room transform and map filter per session. */
export class RoomPath {
 private matcher:MapMatcher
 private raw:Point[]=[]
 private corrected:Point[]=[]
 private processed=0
 private lost=false
 private room:Room
 constructor(room:Room){this.room=room;this.matcher=new MapMatcher(room)}
 update(points:Point[]):MatchedPath {
  const aligned=alignForward(points)
  if(!aligned)return {raw:[],corrected:[],lost:false}
  const world=aligned.map(p=>{const v=roomVector(p,this.room.heading);return {x:this.room.start.x+v.x,y:this.room.start.y+v.y}})
  if(!this.processed){this.raw=[world[0]];this.corrected=[world[0]];this.processed=1}
  while(this.processed<world.length){
   const previous=world[this.processed-1],next=world[this.processed]
   this.raw.push(next)
   if(!this.lost){const p=this.matcher.step({x:next.x-previous.x,y:next.y-previous.y});if(p)this.corrected.push(p);else this.lost=true}
   this.processed++
  }
  return {raw:[...this.raw],corrected:[...this.corrected],lost:this.lost}
 }
}
