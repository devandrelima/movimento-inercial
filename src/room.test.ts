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
