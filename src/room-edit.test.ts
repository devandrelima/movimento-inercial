import {describe,expect,it} from 'vitest'
import {DEFAULT_ROOM,validRoom,type Room} from './room'
import {coversPoint,fitView,growView,handleZones,hitTest,resizeRect,resizeRoom} from './room-edit'

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
 it('respeita o mínimo de 1 m e o máximo de 500 m',()=>{
  const empty:Room={...room,start:{x:0,y:0},obstacles:[]}
  expect(resizeRoom(empty,'e',{x:0.2,y:0}).room.width).toBe(1)
  expect(resizeRoom(empty,'ne',{x:80,y:80}).room).toMatchObject({width:80,height:80})
  expect(resizeRoom(empty,'ne',{x:900,y:900}).room).toMatchObject({width:500,height:500})
  expect(resizeRoom({...empty,width:500},'w',{x:-9,y:0}).room.width).toBe(500)
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

describe('janela da planta',()=>{
 it('ajusta a sala deixando a folga em pixels dos dois lados',()=>{
  const v=fitView(10,5,500,400,20),scale=500/v.w
  expect(v.x).toBeCloseTo(-20/scale);expect(v.w).toBeCloseTo(10+2*20/scale);expect(scale*10).toBeCloseTo(460)
  const tall=fitView(5,10,500,400,20);expect(400/tall.h*10).toBeCloseTo(360)
 })
 it('não muda a janela enquanto a sala cabe',()=>{
  const view={x:-1,y:-1,w:12,h:8},vis={l:-1,r:11,b:-1,t:7}
  expect(growView(view,vis,{l:0,r:10,b:0,t:6},1,0.5)).toEqual(view)
  expect(growView(view,vis,{l:0,r:9.5,b:0,t:6},1,0.5,0.01)).toEqual(view)
 })
 it('afasta a janela gradualmente quando a sala passa do limite visível',()=>{
  const view={x:-1,y:-1,w:12,h:8},vis={l:-1,r:11,b:-1,t:7}
  const a=growView(view,vis,{l:0,r:20,b:0,t:6},1,0.5)
  expect(a.x).toBe(-1);expect(a.y).toBe(-1);expect(a.x+a.w).toBeCloseTo(11+(21-11)*0.5);expect(a.h).toBe(8)
  const b=growView(a,vis,{l:-4,r:20,b:0,t:12},1,1);expect(b.x).toBe(-5);expect(b.x+b.w).toBe(21);expect(b.y+b.h).toBe(13)
 })
})

describe('alvo de um toque no editor',()=>{
 const base:Room={...DEFAULT_ROOM,width:10,height:8,start:{x:5,y:6},obstacles:[]}
 const withObstacles=(...o:{id:string;x:number;y:number;width:number;height:number}[]):Room=>({...base,obstacles:o})
 const ppu=40 // 1 px = 2,5 cm
 const hit=(r:Room,x:number,y:number,o:Partial<Parameters<typeof hitTest>[2]>={})=>hitTest(r,{x,y},{ppu,selectedId:null,roomActive:true,...o})

 it('obstáculo pequeno encostado na parede é selecionado pelo próprio centro (não vira alça da sala)',()=>{
  const r=withObstacles({id:'a',x:0,y:3,width:0.4,height:0.4})
  expect(hit(r,0.2,3.2)).toEqual({kind:'obstacle',id:'a'})
 })
 it('obstáculo no canto, fino ao longo da parede ou rente ao topo também',()=>{
  const r=withObstacles({id:'canto',x:0,y:0,width:0.5,height:0.5},{id:'fino',x:9.6,y:2,width:0.4,height:3},{id:'topo',x:4,y:7.7,width:1,height:0.3})
  expect(hit(r,0.25,0.25)).toEqual({kind:'obstacle',id:'canto'})
  expect(hit(r,9.8,3.5)).toEqual({kind:'obstacle',id:'fino'})
  expect(hit(r,4.5,7.85)).toEqual({kind:'obstacle',id:'topo'})
 })
 it('aceita uma pequena tolerância fora do obstáculo, só dentro da sala',()=>{
  const r=withObstacles({id:'a',x:3,y:3,width:0.5,height:0.5})
  expect(hit(r,3.25,3.5+5/ppu)).toEqual({kind:'obstacle',id:'a'}) // ~5 px acima
  expect(hit(r,3.25,3.5+30/ppu)).toBeNull()                       // 30 px: vazio
  // fora da sala vale a faixa de alça da sala, não a tolerância do obstáculo
  const wall=withObstacles({id:'w',x:9.6,y:2,width:0.4,height:3})
  expect(hit(wall,10+6/ppu,3.5)).toEqual({kind:'handle',target:'room',dir:'e'})
 })
 it('a alça da sala fica só do lado de fora da borda (e uma faixa fina por dentro)',()=>{
  const r=base
  expect(hit(r,10+8/ppu,4)).toEqual({kind:'handle',target:'room',dir:'e'})
  expect(hit(r,10-3/ppu,4)).toEqual({kind:'handle',target:'room',dir:'e'})
  expect(hit(r,10-12/ppu,4)).toBeNull()                          // além da faixa fina: espaço vazio
  expect(hit(r,-8/ppu,8+8/ppu)).toEqual({kind:'handle',target:'room',dir:'nw'}) // canto vence aresta
  expect(hit(r,5,-8/ppu)).toEqual({kind:'handle',target:'room',dir:'s'})
 })
 it('com um obstáculo selecionado, a sala não oferece alças, mas o obstáculo oferece as dele',()=>{
  const r=withObstacles({id:'a',x:2,y:2,width:2,height:1})
  expect(hit(r,10+8/ppu,4,{selectedId:'a',roomActive:false})).toBeNull()
  expect(hit(r,4,3,{selectedId:'a',roomActive:false})).toEqual({kind:'handle',target:'a',dir:'ne'})
  expect(hit(r,4+8/ppu,2.5,{selectedId:'a',roomActive:false})).toEqual({kind:'handle',target:'a',dir:'e'})
  expect(hit(r,3,2.5,{selectedId:'a',roomActive:false})).toEqual({kind:'obstacle',id:'a'}) // miolo: mover
 })
 it('obstáculo pequeno selecionado ainda pode ser movido pelo centro (zonas encolhem)',()=>{
  const r=withObstacles({id:'a',x:2,y:2,width:0.5,height:0.5}) // 20 px
  expect(hit(r,2.25,2.25,{selectedId:'a',roomActive:false})).toEqual({kind:'obstacle',id:'a'})
 })
 it('entre obstáculos sobrepostos vence o menor; entre vizinhos separados vence o que contém o ponto',()=>{
  const r=withObstacles({id:'grande',x:2,y:2,width:4,height:3},{id:'pequeno',x:3,y:3,width:0.5,height:0.5})
  expect(hit(r,3.2,3.2)).toEqual({kind:'obstacle',id:'pequeno'});expect(hit(r,5,4.5)).toEqual({kind:'obstacle',id:'grande'})
  const vizinhos=withObstacles({id:'A',x:6,y:4,width:0.5,height:0.5},{id:'B',x:6.6,y:4,width:0.5,height:0.5})
  expect(hit(vizinhos,6.25,4.25)).toEqual({kind:'obstacle',id:'A'});expect(hit(vizinhos,6.85,4.25)).toEqual({kind:'obstacle',id:'B'})
  expect(hit(vizinhos,6.54,4.25)).toEqual({kind:'obstacle',id:'A'});expect(hit(vizinhos,6.57,4.25)).toEqual({kind:'obstacle',id:'B'}) // no vão de 10 cm: o mais próximo
 })
 it('o ponto inicial tem prioridade sobre o que está por perto, mas só no seu raio',()=>{
  const r=withObstacles({id:'a',x:5.3,y:5.9,width:0.5,height:0.5})
  expect(hit(r,5.1,6)).toEqual({kind:'start'})
  expect(hit(r,5.45,6.15)).toEqual({kind:'obstacle',id:'a'})
 })
 it('toque tem alvos maiores que o mouse',()=>{
  const r=withObstacles({id:'a',x:3,y:3,width:0.5,height:0.5})
  const d=13/ppu
  expect(hit(r,3.25,3.5+d)).toBeNull();expect(hit(r,3.25,3.5+d,{touch:true})).toEqual({kind:'obstacle',id:'a'})
 })
 it('clique no vazio não escolhe nada',()=>{expect(hit(base,2,2)).toBeNull();expect(hit(base,5,3)).toBeNull()})
 it('as zonas colocam canto antes de aresta',()=>{
  const z=handleZones({x:0,y:0,width:4,height:2},0.3,0.2);expect(z.slice(0,4).map(v=>v.dir)).toEqual(['ne','nw','se','sw'])
  expect(z.find(v=>v.dir==='e')).toMatchObject({x0:3.8,x1:4.3,y0:0.2,y1:1.8})
 })
})
