import {describe,expect,it} from 'vitest'
import {alignForward,headingAngle,zoomOffset} from './map-geometry'
describe('mapa',()=>{
 it('usa o primeiro deslocamento para cima e preserva esquerda e direita',()=>{
  const result=alignForward([{x:0,y:0},{x:1,y:0},{x:1,y:-1},{x:1,y:1}])!
  expect(result[1].x).toBeCloseTo(0);expect(result[1].y).toBeCloseTo(1)
  expect(result[2].x).toBeCloseTo(1);expect(result[3].x).toBeCloseTo(-1)
 })
 it('aguarda um deslocamento inicial suficiente',()=>expect(alignForward([{x:0,y:0},{x:0.1,y:0.1}])).toBeNull())
 it('mantém o ponto sob o cursor fixo ao ampliar',()=>expect(zoomOffset({x:0,y:0},{x:100,y:50},2)).toEqual({x:-100,y:-50}))
})
describe('direção da ponta da trajetória',()=>{
 it('aponta para cima, direita, baixo e esquerda (Y da tela para baixo)',()=>{
  expect(headingAngle([{x:0,y:0},{x:0,y:1}])).toBeCloseTo(-90)
  expect(headingAngle([{x:0,y:0},{x:1,y:0}])).toBeCloseTo(0)
  expect(headingAngle([{x:0,y:1},{x:0,y:0}])).toBeCloseTo(90)
  expect(Math.abs(headingAngle([{x:1,y:0},{x:0,y:0}])!)).toBeCloseTo(180)
 })
 it('suaviza passos curtos usando a posição pelo menos 25 cm atrás',()=>{
  const walk=[{x:0,y:0},{x:0,y:0.1},{x:0,y:0.2},{x:0,y:0.3},{x:0.02,y:0.31}]
  expect(headingAngle(walk)).toBeCloseTo(-90,-1)
 })
 it('mantém a última direção enquanto o usuário está parado',()=>{
  const still=[{x:0,y:0},{x:1,y:0},{x:1,y:0},{x:1,y:0},{x:1,y:0.001}]
  expect(headingAngle(still)).toBeCloseTo(0,0)
 })
 it('não inventa direção sem deslocamento',()=>{
  expect(headingAngle([])).toBeNull()
  expect(headingAngle([{x:2,y:3}])).toBeNull()
  expect(headingAngle([{x:0,y:0},{x:0.01,y:0.01}])).toBeNull()
 })
 it('usa o deslocamento curto disponível quando é o único',()=>{
  expect(headingAngle([{x:0,y:0},{x:0.1,y:0}])).toBeCloseTo(0)
 })
})
