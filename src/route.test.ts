import {describe,it,expect} from 'vitest'
import {DEFAULT_ROOM,traversable,type Room} from './room'
import {clearPoint,distanceToRoute,freePoint,planRoute,ROUTE_CLEARANCE,routeRoom,routeStep} from './route'
import {MapMatcher,RoomPath} from './map-match'

const room:Room={...DEFAULT_ROOM,width:10,height:8,start:{x:1,y:4},obstacles:[{id:'mesa',x:4,y:3,width:2,height:2}]}
const goal={x:9,y:4}
describe('rota sugerida por A*',()=>{
 it('contorna o obstáculo com margem e mantém origem e destino exatos',()=>{
  const path=planRoute(room,room.start,goal)!
  expect(path).not.toBeNull();expect(path[0]).toEqual(room.start);expect(path.at(-1)).toEqual(goal);expect(path.length).toBeGreaterThan(2)
  const expanded=routeRoom(room),m=ROUTE_CLEARANCE,shift=(p:{x:number;y:number})=>({x:p.x-m,y:p.y-m})
  for(let i=1;i<path.length;i++)expect(traversable(expanded,shift(path[i-1]),shift(path[i]))).toBe(true)
 })
 it('informa rota indisponível para parede, destino inválido ou margem insuficiente',()=>{
  const wall={...room,obstacles:[{id:'wall',x:4,y:0,width:1,height:8}]}
  expect(planRoute(wall,wall.start,goal)).toBeNull()
  expect(planRoute(room,room.start,{x:5,y:4})).toBeNull()
  expect(clearPoint(room,{x:.1,y:1})).toBe(false)
 })
 it('mede distância até o segmento, inclusive extremidades',()=>{
  const route=[{x:1,y:1},{x:3,y:1}]
  expect(distanceToRoute({x:2,y:3},route)).toBeCloseTo(2)
  expect(distanceToRoute({x:0,y:1},route)).toBeCloseTo(1)
 })
 it('não movimenta a posição por causa do destino e permite seguir caminho diferente',()=>{
  const open:Room={...room,obstacles:[],start:{x:2,y:2}}
  const f=new MapMatcher(open);f.setRoute(planRoute(open,open.start,{x:8,y:2}))
  expect(f.step({x:0,y:0})).toEqual(open.start)
  let p=open.start
  for(let i=0;i<4;i++)p=f.step({x:0,y:.5})!
  expect(p.x).toBeCloseTo(2);expect(p.y).toBeCloseTo(4)
 })
 it('aceita contornar um obstáculo pelo lado oposto ao sugerido',()=>{
  const start={x:2,y:4},target={x:8,y:4},scenario={...room,start}
  const route=planRoute(scenario,start,target)!,upper=route.some(p=>p.y>5)
  const sign=upper?-1:1,matcher=new MapMatcher(scenario);matcher.setRoute(route)
  let p=start
  for(const delta of [...Array.from({length:5},()=>({x:0,y:sign*.4})),...Array.from({length:10},()=>({x:.4,y:0}))]){
   const next=matcher.step(delta);expect(next).not.toBeNull();expect(traversable(scenario,p,next!)).toBe(true);p=next!
  }
  expect(p.x).toBeGreaterThan(5);expect(sign*(p.y-4)).toBeGreaterThan(1)
 })
 it('recalcula após desvio persistente sem inventar chegada ao destino',()=>{
  const open:Room={...room,obstacles:[],start:{x:2,y:2},heading:'up'}
  const path=new RoomPath(open,{x:2,y:7})
  const result=path.update([{x:0,y:0},{x:0,y:1},{x:1.5,y:1},{x:2,y:1},{x:2.5,y:1}])
  expect(result.lost).toBe(false)
  expect(result.corrected.at(-1)!.x).toBeGreaterThan(4)
  expect(result.route![0].x).toBeGreaterThan(4)
  expect(result.route!.at(-1)).toEqual({x:2,y:7})
 })
})

describe('rota em salas grandes',()=>{
 const sized=(size:number):Room=>({version:1,width:size,height:size,start:{x:2,y:2},heading:'up',obstacles:[{id:'w',x:size/2,y:0,width:2,height:size-20},{id:'v',x:size/4,y:20,width:2,height:size-20}]})
 it('mantém 25 cm até 100 × 100 m e engrossa a grade depois, sem passar de ~160 mil células',()=>{
  expect(routeStep(sized(30))).toBe(0.25);expect(routeStep(sized(100))).toBe(0.25)
  expect(routeStep(sized(200))).toBeCloseTo(0.5);expect(routeStep(sized(500))).toBeCloseTo(1.25)
  for(const size of [101,250,500]){const step=routeStep(sized(size));expect(Math.pow(size/step+1,2)).toBeLessThan(175000)}
 })
 it('planeja rotas válidas em salas de 500 × 500 m em poucos segundos, sem cruzar obstáculos',()=>{
  const room=sized(500),t=performance.now(),path=planRoute(room,room.start,{x:498,y:2})
  expect(performance.now()-t).toBeLessThan(5000)
  expect(path).not.toBeNull()
  for(let i=1;i<path!.length;i++)expect(traversable(room,path![i-1],path![i])).toBe(true)
  expect(path!.some(p=>p.y>20)).toBe(true)
 },20000)
})

describe('origem e destino dentro da margem de 20 cm',()=>{
 const obstacle={id:'a',x:4,y:3,width:2,height:2}
 const interiorKeepsClearance=(r:Room,path:{x:number;y:number}[])=>{
  const expanded=routeRoom(r),m=ROUTE_CLEARANCE,shift=(p:{x:number;y:number})=>({x:p.x-m,y:p.y-m})
  // só o primeiro e o último trecho podem sair da margem; os do meio mantêm os 20 cm
  for(let i=2;i<path.length-1;i++)expect(traversable(expanded,shift(path[i-1]),shift(path[i]))).toBe(true)
  for(let i=1;i<path.length;i++)expect(traversable(r,path[i-1],path[i])).toBe(true)
 }
 it('origem no canto, encostada na parede ou a poucos cm de um obstáculo ainda gera rota',()=>{
  for(const start of [{x:0,y:0},{x:0.05,y:4},{x:3.9,y:4},{x:10,y:8}]){
   const r:Room={...DEFAULT_ROOM,width:10,height:8,start,obstacles:[obstacle]}
   expect(clearPoint(r,start)).toBe(false);expect(freePoint(r,start)).toBe(true)
   const goalPoint={x:8,y:6},path=planRoute(r,start,goalPoint)
   expect(path,JSON.stringify(start)).not.toBeNull();expect(path![0]).toEqual(start);expect(path!.at(-1)).toEqual(goalPoint);interiorKeepsClearance(r,path!)
  }
 })
 it('destino a poucos cm da parede ou do obstáculo também é aceito',()=>{
  const r:Room={...DEFAULT_ROOM,width:10,height:8,start:{x:1,y:1},obstacles:[obstacle]}
  for(const target of [{x:9.95,y:4},{x:6.1,y:4},{x:5,y:7.9}]){
   expect(clearPoint(r,target)).toBe(false)
   const path=planRoute(r,r.start,target);expect(path,JSON.stringify(target)).not.toBeNull();expect(path!.at(-1)).toEqual(target);interiorKeepsClearance(r,path!)
  }
 })
 it('continua recusando pontos fora da sala ou dentro de obstáculos, e a origem encostada não atravessa obstáculos',()=>{
  const r:Room={...DEFAULT_ROOM,width:10,height:8,start:{x:3.95,y:4},obstacles:[obstacle]}
  expect(planRoute(r,r.start,{x:5,y:4})).toBeNull();expect(planRoute(r,r.start,{x:11,y:4})).toBeNull();expect(planRoute(r,r.start,{x:-1,y:4})).toBeNull()
  const wall:Room={...r,start:{x:0.05,y:4},obstacles:[{id:'w',x:2,y:0,width:1,height:8}]}
  expect(planRoute(wall,wall.start,{x:8,y:4})).toBeNull()
 })
 it('em sala grande (grade grossa) a origem na parede também gera rota',()=>{
  const big:Room={...DEFAULT_ROOM,width:500,height:500,start:{x:0,y:0},obstacles:[{id:'w',x:100,y:0,width:2,height:400}]}
  const path=planRoute(big,big.start,{x:300,y:100});expect(path).not.toBeNull();for(let i=1;i<path!.length;i++)expect(traversable(big,path![i-1],path![i])).toBe(true)
 })
})
