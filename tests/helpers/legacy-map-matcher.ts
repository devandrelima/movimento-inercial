// Snapshot of the previous matcher, retained only for reproducible offline comparison.
import {traversable,type Room} from '../../src/room'
import type {Point} from '../../src/tracker'
export class LegacyMapMatcher {
 private particles:Point[]
 private randomState=0x13579bdf
 private output:Point
 private failed=false
 constructor(private room:Room,private count=128){this.particles=Array.from({length:count},()=>({...room.start}));this.output={...room.start}}
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
