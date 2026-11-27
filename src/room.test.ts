import {describe,expect,it} from 'vitest'
import {DEFAULT_ROOM,roomVector,traversable,validRoom,type Room} from './room'
import {MapMatcher,RoomPath} from './map-match'
const room:Room={...DEFAULT_ROOM,width:10,height:10,start:{x:1,y:1},obstacles:[{id:'a',x:3,y:3,width:2,height:2}]}
describe('geometria da sala',()=>{
 it('verifica pontos e todo o segmento inclusive bordas de obstáculos',()=>{
  expect(traversable(room,{x:2,y:4},{x:6,y:4})).toBe(false)
  expect(traversable(room,{x:2,y:3},{x:6,y:3})).toBe(false)
  expect(traversable(room,{x:2,y:2},{x:6,y:2})).toBe(true)
  expect(traversable(room,{x:1,y:1},{x:-1,y:1})).toBe(false)
 })
 it('rejeita obstáculos fora da sala e origem dentro deles',()=>{
  expect(validRoom(room)).toBe(true);expect(validRoom({...room,start:{x:4,y:4}})).toBe(false)
  expect(validRoom({...room,obstacles:[{id:'x',x:9,y:9,width:2,height:2}]})).toBe(false)
 })
 it('aceita salas de 1 a 500 m por lado e recusa fora disso',()=>{
  const big:Room={...DEFAULT_ROOM,width:500,height:500,start:{x:250,y:250},obstacles:[{id:'a',x:100,y:100,width:50,height:50}]}
  expect(validRoom(big)).toBe(true);expect(validRoom({...big,width:500.01})).toBe(false);expect(validRoom({...big,height:501})).toBe(false)
  expect(validRoom({...big,width:1,height:1,start:{x:0.5,y:0.5},obstacles:[]})).toBe(true);expect(validRoom({...big,width:0.99})).toBe(false)
  expect(validRoom({...big,obstacles:[{id:'a',x:480,y:480,width:21,height:5}]})).toBe(false)
 })
 it('alinha frente e direita aos eixos selecionados',()=>{
  const forward=roomVector({x:0,y:1},'right');expect(forward.x).toBeCloseTo(1);expect(forward.y).toBeCloseTo(0)
  expect(roomVector({x:1,y:0},'right')).toEqual({x:0,y:-1})
 })
})
describe('filtro de mapa experimental',()=>{
 it('não inventa movimento com deslocamento zero',()=>{const f=new MapMatcher(room);expect(f.step({x:0,y:0})).toEqual(room.start)})
 it('mantém segmentos válidos ou informa perda quando o caminho é bloqueado',()=>{
  const blocked:Room={...room,obstacles:[{id:'wall',x:2,y:0,width:1,height:10}]};const f=new MapMatcher(blocked)
  const point=f.step({x:4,y:0});expect(point).toBeNull();expect(f.step({x:0,y:1})).toBeNull()
 })
 it('alinha o percurso, conserva o original e nunca atravessa obstáculos no corrigido',()=>{
  const p=new RoomPath(room),r=p.update([{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:3,y:3}])
  expect(r.raw).toHaveLength(4);for(let i=1;i<r.corrected.length;i++)expect(traversable(room,r.corrected[i-1],r.corrected[i])).toBe(true)
  expect(p.update([{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:3,y:3},{x:3,y:4}]).raw).toHaveLength(5)
 })
})

describe('hipóteses de direção e colisão',()=>{
 it('preserva a previsão em espaço aberto quando o mapa não exclui hipóteses',()=>{
  const open:Room={...DEFAULT_ROOM,width:30,height:30,start:{x:15,y:15},obstacles:[]}
  const matcher=new MapMatcher(open);let expected={...open.start}
  for(const delta of [{x:.5,y:0},{x:.5,y:0},{x:.35,y:.35},{x:0,y:.5}]){
   expected={x:expected.x+delta.x,y:expected.y+delta.y}
   const point=matcher.step(delta)!;expect(point.x).toBeCloseTo(expected.x,10);expect(point.y).toBeCloseTo(expected.y,10)
  }
  expect(matcher.constrained).toBe(false)
 })
 it('não inventa movimento nem repulsão com deslocamento nulo junto ao obstáculo',()=>{
  const near:Room={...room,start:{x:2.99,y:4}}
  const matcher=new MapMatcher(near)
  for(let i=0;i<20;i++)expect(matcher.step({x:0,y:0})).toEqual(near.start)
  expect(matcher.constrained).toBe(false)
 })
 it('usa alternativas viáveis e informa quando o deslocamento proposto atinge um obstáculo',()=>{
  const scenario:Room={...room,start:{x:2.5,y:4}}
  const matcher=new MapMatcher(scenario)
  const point=matcher.step({x:0.5,y:0})
  expect(matcher.constrained).toBe(true)
  expect(point).not.toBeNull()
  expect(traversable(scenario,scenario.start,point!)).toBe(true)
  expect(point!.x).toBeLessThan(3)
 })
 it('informa na trajetória quando o mapa precisou restringir uma previsão',()=>{
  const scenario:Room={...room,start:{x:2.5,y:4},heading:'right'}
  const path=new RoomPath(scenario)
  const result=path.update([{x:0,y:0},{x:0,y:.8}])
  expect(result.raw).toHaveLength(2);expect(result.constrained).toBe(true)
  expect(result.lost).toBe(false);expect(result.corrected).toHaveLength(2)
  expect(traversable(scenario,result.corrected[0],result.corrected[1])).toBe(true)
 })
 it('acompanha um desvio indicado pelos sensores ao redor de um obstáculo',()=>{
  const scenario:Room={...room,start:{x:2.5,y:4}}
  const matcher=new MapMatcher(scenario);let previous=scenario.start
  for(const delta of [{x:.5,y:0},{x:0,y:.5},{x:0,y:.5},{x:0,y:.5},{x:0,y:.5},{x:.5,y:0},{x:.5,y:0}]){
   const next=matcher.step(delta);expect(next).not.toBeNull()
   expect(traversable(scenario,previous,next!)).toBe(true);previous=next!
  }
  expect(matcher.constrained).toBe(true);expect(previous.x).toBeGreaterThan(3);expect(previous.y).toBeGreaterThan(5)
 })
 it('acompanha um retorno indicado por novo deslocamento sem atravessar o obstáculo',()=>{
  const scenario:Room={...room,start:{x:2.5,y:4}}
  const matcher=new MapMatcher(scenario)
  const near=matcher.step({x:.5,y:0})!
  expect(near).not.toBeNull();expect(matcher.constrained).toBe(true)
  const returned=matcher.step({x:-.5,y:0})
  expect(returned).not.toBeNull();expect(returned!.x).toBeLessThan(near.x)
  expect(traversable(scenario,near,returned!)).toBe(true)
 })
 it('não atravessa nem salta barreiras em trajetórias com viradas e retorna nulo se perder hipóteses',()=>{
  const scenario:Room={...room,start:{x:1,y:2}}
  const matcher=new MapMatcher(scenario)
  const deltas=[{x:0.5,y:0},{x:0.5,y:0},{x:0,y:0.6},{x:0,y:0.6},{x:0.6,y:0},{x:0.6,y:0},{x:0.6,y:0}]
  let previous=scenario.start
  for(const delta of deltas){const next=matcher.step(delta);if(!next)break;expect(traversable(scenario,previous,next)).toBe(true);previous=next}
 })
 it('não trata um obstáculo intransponível como prova de retorno',()=>{
  const barrier:Room={...room,obstacles:[{id:'wall',x:2,y:0,width:1,height:10}]}
  const matcher=new MapMatcher(barrier)
  expect(matcher.step({x:4,y:0})).toBeNull()
  expect(matcher.step({x:-1,y:0})).toBeNull()
 })
 it('é reproduzível e não altera a previsão de entrada',()=>{
  const a=new MapMatcher(room),b=new MapMatcher(room),input={x:0.2,y:0.15}
  for(let i=0;i<4;i++)expect(a.step(input)).toEqual(b.step(input))
  expect(input).toEqual({x:0.2,y:0.15})
 })
})
