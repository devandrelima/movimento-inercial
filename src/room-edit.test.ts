import {describe,expect,it} from 'vitest'
import {DEFAULT_ROOM,validRoom,type Room} from './room'
import {coversPoint,resizeRect,resizeRoom} from './room-edit'

const limits={minX:0,minY:0,maxX:10,maxY:8}
const rect={x:4,y:3,width:2,height:2}
const room:Room={...DEFAULT_ROOM,width:10,height:8,start:{x:2,y:2},obstacles:[{id:'a',x:4,y:3,width:2,height:2}]}

describe('redimensionar retângulos',()=>{
 it('uma aresta muda só uma dimensão',()=>{
  expect(resizeRect(rect,'e',{x:7,y:99},limits)).toEqual({x:4,y:3,width:3,height:2})
  expect(resizeRect(rect,'n',{x:99,y:6},limits)).toEqual({x:4,y:3,width:2,height:3})
 })
 it('arestas esquerda e inferior movem a origem do retângulo',()=>{
  expect(resizeRect(rect,'w',{x:3,y:0},limits)).toEqual({x:3,y:3,width:3,height:2})
  expect(resizeRect(rect,'s',{x:0,y:2},limits)).toEqual({x:4,y:2,width:2,height:3})
 })
 it('um canto muda largura e altura juntas',()=>{
  expect(resizeRect(rect,'ne',{x:7,y:6},limits)).toEqual({x:4,y:3,width:3,height:3})
  expect(resizeRect(rect,'sw',{x:3,y:2},limits)).toEqual({x:3,y:2,width:3,height:3})
 })
 it('mantém o tamanho mínimo ao cruzar a aresta oposta',()=>{
  const r=resizeRect(rect,'e',{x:0,y:0},limits);expect(r.x).toBe(4);expect(r.width).toBeCloseTo(0.1)
  const c=resizeRect(rect,'nw',{x:9,y:0},limits);expect(c.x+c.width).toBeCloseTo(6);expect(c.width).toBeCloseTo(0.1);expect(c.height).toBeCloseTo(0.1)
 })
 it('não sai dos limites da sala e ajusta a 5 cm',()=>{
  expect(resizeRect(rect,'se',{x:50,y:-5},limits)).toEqual({x:4,y:0,width:6,height:5})
  expect(resizeRect(rect,'e',{x:7.38,y:0},limits).width).toBeCloseTo(3.4)
 })
})

describe('redimensionar a sala',()=>{
 it('aresta direita e superior só mudam o tamanho',()=>{
  const {room:r,shift}=resizeRoom(room,'ne',{x:12,y:9})
  expect(shift).toEqual({x:0,y:0});expect(r.width).toBe(12);expect(r.height).toBe(9);expect(r.obstacles[0]).toMatchObject({x:4,y:3})
  expect(validRoom(r)).toBe(true)
 })
 it('aresta esquerda desloca a origem e o conteúdo, mantendo-o parado em relação à tela',()=>{
  const {room:r,shift}=resizeRoom(room,'w',{x:1,y:0})
  expect(shift).toEqual({x:1,y:0});expect(r.width).toBe(9);expect(r.start).toEqual({x:1,y:2});expect(r.obstacles[0].x).toBe(3)
  expect(validRoom(r)).toBe(true)
 })
 it('crescer pela esquerda ou por baixo é permitido e desloca o conteúdo para a direita e para cima',()=>{
  const {room:r,shift}=resizeRoom(room,'sw',{x:-2,y:-1})
  expect(shift).toEqual({x:-2,y:-1});expect(r.width).toBe(12);expect(r.height).toBe(9);expect(r.start).toEqual({x:4,y:3});expect(r.obstacles[0]).toMatchObject({x:6,y:4})
  expect(validRoom(r)).toBe(true)
 })
 it('não encolhe além de obstáculos e ponto inicial',()=>{
  expect(resizeRoom(room,'e',{x:1,y:0}).room.width).toBe(6)
  expect(resizeRoom(room,'w',{x:9,y:0}).room.width).toBe(8)
  expect(resizeRoom(room,'n',{x:0,y:0}).room.height).toBe(5)
  expect(resizeRoom({...room,obstacles:[]},'e',{x:0,y:0}).room.width).toBe(2)
 })
 it('respeita o mínimo de 1 m e o máximo de 30 m',()=>{
  const empty:Room={...room,start:{x:0,y:0},obstacles:[]}
  expect(resizeRoom(empty,'e',{x:0.2,y:0}).room.width).toBe(1)
  expect(resizeRoom(empty,'ne',{x:80,y:80}).room).toMatchObject({width:30,height:30})
  expect(resizeRoom({...empty,width:30},'w',{x:-9,y:0}).room.width).toBe(30)
 })
 it('ignora valores inválidos de obstáculos em edição',()=>{
  const broken:Room={...room,obstacles:[{id:'a',x:NaN,y:3,width:2,height:2}]}
  expect(Number.isFinite(resizeRoom(broken,'e',{x:5,y:0}).room.width)).toBe(true)
 })
})

describe('ponto inicial',()=>{
 it('detecta quando um obstáculo cobre o ponto',()=>{
  expect(coversPoint(rect,{x:5,y:4})).toBe(true);expect(coversPoint(rect,{x:2,y:2})).toBe(false)
 })
})
