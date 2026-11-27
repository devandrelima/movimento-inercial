import {alignInfo} from './map-geometry'
import {roomAngle,roomVector,traversable,type Room} from './room'
import type {Point} from './tracker'
import {distanceToRoute,planRoute} from './route'

type Particle = Point & {headingError:number}
type Candidate = {particle:Particle;weight:number}
const MAX_HEADING_ERROR = Math.PI * 70 / 180
const clampHeading=(angle:number)=>Math.max(-MAX_HEADING_ERROR,Math.min(MAX_HEADING_ERROR,angle))

/**
 * Experimental map-aware estimator. Heading and speed uncertainty are heuristics,
 * not calibrated probabilities. The map rules out impossible motion; it does
 * not observe which side of an obstacle the user actually took.
 */
export class MapMatcher {
 private particles:Particle[]
 private randomState=0x13579bdf
 private output:Point
 private failed=false
 private room:Room
 private count:number
 private mapConstrained=false
 private route:Point[]|null=null
 setRoute(route:Point[]|null){this.route=route}
 constructor(room:Room,count=128){
  if(!Number.isInteger(count)||count<1)throw new Error('Quantidade de hipóteses inválida')
  this.room=room;this.count=count;this.output={...room.start}
  this.particles=Array.from({length:count},()=>({...room.start,headingError:clampHeading(this.normal()*0.18)}))
 }
 private random():number {this.randomState=(Math.imul(1664525,this.randomState)+1013904223)>>>0;return (this.randomState+.5)/4294967296}
 private normal():number {return Math.sqrt(-2*Math.log(this.random()))*Math.cos(2*Math.PI*this.random())}
 get constrained():boolean{return this.mapConstrained}
 step(delta:Point):Point|null {
  if(this.failed)return null
  const distance=Math.hypot(delta.x,delta.y)
  if(!Number.isFinite(distance)){this.failed=true;return null}
  // No artificial repulsion or motion when the sensor model predicts no movement.
  if(distance===0)return {...this.output}
  const desired={x:this.output.x+delta.x,y:this.output.y+delta.y}
  if(!traversable(this.room,this.output,desired))this.mapConstrained=true
  const candidates:Candidate[]=[]
  // A bounded, weak preference only near the current route; never excludes a valid alternative.
  const guide=this.route && distanceToRoute(this.output,this.route)<1 ? this.route : null
  for(const p of this.particles){
   const heading=clampHeading(p.headingError+this.normal()*0.035*Math.sqrt(distance))
   const scale=Math.max(0.55,Math.min(1.45,1+this.normal()*0.10))
   const propose=(angle:number,weight:number):boolean=>{
    const adjusted=clampHeading(angle),c=Math.cos(adjusted),s=Math.sin(adjusted)
    const next:Particle={x:p.x+scale*(c*delta.x-s*delta.y),y:p.y+scale*(s*delta.x+c*delta.y),headingError:adjusted}
    // Both checks are needed: preserve a feasible particle history AND avoid a
    // visible jump across an obstacle from the last displayed estimate.
    if(!traversable(this.room,p,next)||!traversable(this.room,this.output,next))return false
    const preference=guide ? 1-0.02*Math.min(1,distanceToRoute(next,guide)) : 1
    candidates.push({particle:next,weight:weight*preference});return true
   }
   if(!propose(heading,1)){
    this.mapConstrained=true
    // Competing left/right alternatives are possible hypotheses, not evidence
    // of a real collision, turn or return. Their lower weight reflects their
    // greater disagreement with the model's proposed direction.
    for(const [turn,weight] of [[Math.PI/6,0.16],[-Math.PI/6,0.16],[Math.PI/3,0.025],[-Math.PI/3,0.025]]){
     if(Math.abs(heading+turn)<=MAX_HEADING_ERROR)propose(heading+turn,weight)
    }
   }
  }
  if(!candidates.length){this.failed=true;return null}
  const total=candidates.reduce((sum,c)=>sum+c.weight,0)
  const mean=candidates.reduce((acc,c)=>({x:acc.x+c.particle.x*c.weight/total,y:acc.y+c.particle.y*c.weight/total}),{x:0,y:0})
  // A mean between two modes can lie inside an obstacle. Never draw such a
  // shortcut: fall back to an actually reachable particle in that case.
  if(!this.mapConstrained)this.output=desired
  else if(traversable(this.room,this.output,mean))this.output=mean
  else {
   const closest=candidates.reduce((best,c)=>Math.hypot(c.particle.x-mean.x,c.particle.y-mean.y)<Math.hypot(best.particle.x-mean.x,best.particle.y-mean.y)?c:best)
   this.output={x:closest.particle.x,y:closest.particle.y}
  }
  // Systematic weighted resampling; all candidates are reachable from output's
  // previous position, so later updates cannot jump between disconnected modes.
  const start=this.random()*total/this.count;let index=0,cumulative=candidates[0].weight
  this.particles=Array.from({length:this.count},(_,i)=>{
   const target=start+i*total/this.count
   while(index<candidates.length-1&&cumulative<target){index++;cumulative+=candidates[index].weight}
   return {...candidates[index].particle}
  })
  return {...this.output}
 }
}
/** `provisional`: a direção inicial ainda não foi confirmada (menos de 1 m de percurso). */
export type MatchedPath={raw:Point[];corrected:Point[];lost:boolean;constrained:boolean;route:Point[]|null;provisional?:boolean}
/** Incrementally applies one local-to-room transform and map filter per session. */
export class RoomPath {
 private matcher:MapMatcher
 private raw:Point[]=[]
 private corrected:Point[]=[]
 private processed=0
 private lost=false
 private room:Room
 private route:Point[]|null
 private goal:Point|null
 private offRoute=0
 constructor(room:Room,goal:Point|null=null){this.room=room;this.goal=goal;this.matcher=new MapMatcher(room);this.route=goal?planRoute(room,room.start,goal):null;this.initialRoute=this.route;this.matcher.setRoute(this.route)}
 private anchor=-1
 private anchorFinal=false
 private initialRoute:Point[]|null
 private restart(){
  // A nova âncora (provisória → final) muda a direção de todo o trecho já calculado: recomeça do zero.
  this.matcher=new MapMatcher(this.room);this.route=this.initialRoute;this.matcher.setRoute(this.route)
  this.raw=[];this.corrected=[];this.processed=0;this.lost=false;this.offRoute=0
 }
 update(points:Point[]):MatchedPath {
  const info=alignInfo(points)
  if(!info)return {raw:[],corrected:[],lost:false,constrained:false,route:this.route}
  if(info.anchorIndex!==this.anchor||info.final!==this.anchorFinal){if(this.processed)this.restart();this.anchor=info.anchorIndex;this.anchorFinal=info.final}
  const aligned=info.points
  const world=aligned.map(p=>{const v=roomVector(p,roomAngle(this.room));return {x:this.room.start.x+v.x,y:this.room.start.y+v.y}})
  if(!this.processed){this.raw=[world[0]];this.corrected=[world[0]];this.processed=1}
 while(this.processed<world.length){
   const previous=world[this.processed-1],next=world[this.processed]
   this.raw.push(next)
   if(!this.lost){const p=this.matcher.step({x:next.x-previous.x,y:next.y-previous.y});if(p){
    this.corrected.push(p)
    if(this.goal&&this.route){
     this.offRoute=distanceToRoute(p,this.route)>1?this.offRoute+1:0
     if(this.offRoute>=3){this.route=planRoute(this.room,p,this.goal);this.matcher.setRoute(this.route);this.offRoute=0}
    }
   }else this.lost=true}
   this.processed++
  }
  return {raw:[...this.raw],corrected:[...this.corrected],lost:this.lost,constrained:this.matcher.constrained,route:this.route,provisional:!this.anchorFinal}
 }
}
