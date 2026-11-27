import {describe,it,expect} from 'vitest'
import {readFileSync,writeFileSync} from 'node:fs'
import {MapMatcher} from '../src/map-match'
import {distanceToRoute,planRoute} from '../src/route'
import {traversable,type Room} from '../src/room'
import type {Point} from '../src/tracker'

type Scenario={room:Room;truth:number[][];deltas:number[][]}
describe.skipIf(!process.env.RONIN_MAP_FIXTURE)('rota sugerida: replay local',()=>{
 it('compara os mesmos pontos com e sem preferência pelo destino',()=>{
  const fixture=JSON.parse(readFileSync(process.env.RONIN_MAP_FIXTURE!,'utf8')) as {scenarios:Scenario[]}
  let eligible=0,skipped=0,common=0,plainError=0,guidedError=0,plainLost=0,guidedLost=0
  for(const s of fixture.scenarios){
   const last=s.truth.at(-1)!,goal={x:last[0],y:last[1]};let route=planRoute(s.room,s.room.start,goal)
   if(!route){skipped++;continue}eligible++
   const plain=new MapMatcher(s.room),guided=new MapMatcher(s.room);guided.setRoute(route)
   let a:Point|null=s.room.start,b:Point|null=s.room.start,off=0
   for(let i=0;i<s.deltas.length;i++){
    const d={x:s.deltas[i][0],y:s.deltas[i][1]}
    if(a){const next:Point|null=plain.step(d);if(next)expect(traversable(s.room,a,next)).toBe(true);else plainLost++;a=next}
    if(b){const next:Point|null=guided.step(d);if(next){expect(traversable(s.room,b,next)).toBe(true);if(route){off=distanceToRoute(next,route)>1?off+1:0;if(off>=3){route=planRoute(s.room,next,goal);guided.setRoute(route);off=0}}}else guidedLost++;b=next}
    if(a&&b){const actual={x:s.truth[i+1][0],y:s.truth[i+1][1]};common++;plainError+=Math.hypot(a.x-actual.x,a.y-actual.y);guidedError+=Math.hypot(b.x-actual.x,b.y-actual.y)}
   }
  }
  expect(eligible).toBeGreaterThan(0)
  const result={eligible,skipped,common,plainMean:plainError/common,guidedMean:guidedError/common,plainLost,guidedLost}
  if(process.env.RONIN_ROUTE_RESULT)writeFileSync(process.env.RONIN_ROUTE_RESULT,JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
 },120000)
})
