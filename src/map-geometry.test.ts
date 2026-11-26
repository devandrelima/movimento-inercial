import {describe,expect,it} from 'vitest'
import {alignForward,zoomOffset} from './map-geometry'
describe('mapa',()=>{
 it('usa o primeiro deslocamento para cima e preserva esquerda e direita',()=>{
  const result=alignForward([{x:0,y:0},{x:1,y:0},{x:1,y:-1},{x:1,y:1}])!
  expect(result[1].x).toBeCloseTo(0);expect(result[1].y).toBeCloseTo(1)
  expect(result[2].x).toBeCloseTo(1);expect(result[3].x).toBeCloseTo(-1)
 })
 it('aguarda um deslocamento inicial suficiente',()=>expect(alignForward([{x:0,y:0},{x:0.1,y:0.1}])).toBeNull())
 it('mantém o ponto sob o cursor fixo ao ampliar',()=>expect(zoomOffset({x:0,y:0},{x:100,y:50},2)).toEqual({x:-100,y:-50}))
})
