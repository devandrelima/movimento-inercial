import {describe,expect,it} from 'vitest'
import {alignForward,alignInfo,applyGesture,gesturePose,gridStep,headingAngle,initialView,rotateAbout,rotateVector,screenToLayer,wrapAngle,zoomOffset,type View} from './map-geometry'
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

describe('grade e vista inicial para salas grandes',()=>{
 it('mantém 1 m em zoom normal e engrossa a grade ao afastar',()=>{
  expect(gridStep(48)).toBe(1);expect(gridStep(12)).toBe(1);expect(gridStep(10)).toBe(1)
  expect(gridStep(5)).toBe(2);expect(gridStep(1.6)).toBe(10);expect(gridStep(0.5)).toBe(20)
  expect(gridStep(0.001)).toBe(500)
 })
 it('mantém o zoom padrão e a origem no centro quando a sala cabe',()=>{
  expect(initialView({width:10,height:8,start:{x:1,y:1}},900,750,48,0.5)).toEqual({scale:48,offset:{x:0,y:0}})
 })
 it('afasta e centraliza a sala quando ela não cabe',()=>{
  const v=initialView({width:500,height:500,start:{x:10,y:20}},900,750,48,0.5)
  expect(v.scale).toBeCloseTo(0.9*750/500)
  // o centro da sala (250, 250) cai no centro da área: origem deslocada por -(250-10), +(250-20) metros
  expect(v.offset.x).toBeCloseTo(-240*v.scale);expect(v.offset.y).toBeCloseTo(230*v.scale)
  expect(500*v.scale).toBeLessThanOrEqual(750)
 })
 it('respeita a escala mínima e áreas ainda sem tamanho',()=>{
  expect(initialView({width:500,height:500,start:{x:0,y:0}},100,100,48,0.5).scale).toBe(0.5)
  expect(initialView({width:500,height:500,start:{x:0,y:0}},0,0,48,0.5)).toEqual({scale:48,offset:{x:0,y:0}})
 })
})

describe('alinhamento provisório da direção inicial',()=>{
 it('com 25 cm de deslocamento já define uma direção provisória e desenha',()=>{
  const info=alignInfo([{x:0,y:0},{x:0.05,y:0.08},{x:0,y:0.3}])!
  expect(info.final).toBe(false);expect(info.anchorIndex).toBe(2);expect(info.points[2].x).toBeCloseTo(0);expect(info.points[2].y).toBeCloseTo(0.3)
  expect(alignInfo([{x:0,y:0},{x:0.1,y:0.1}])).toBeNull()
 })
 it('com 75 cm a âncora passa a ser a final e o desenho se reorienta por ela',()=>{
  const pts=[{x:0,y:0},{x:0.1,y:0.25},{x:0.3,y:0.5},{x:0.6,y:0.9}]
  const provisional=alignInfo(pts.slice(0,2))!,final=alignInfo(pts)!
  expect(provisional.final).toBe(false);expect(final.final).toBe(true);expect(final.anchorIndex).toBe(3)
  expect(final.points[3].x).toBeCloseTo(0);expect(final.points[3].y).toBeGreaterThan(1)
  expect(alignForward(pts)).toEqual(final.points)
 })
})

describe('zoom, giro e deslocamento do mapa',()=>{
 // tela = offset + R(rotation)·(scale·mundo), com o mundo em unidades da camada
 const toScreen=(v:View,w:{x:number;y:number})=>{const r=rotateVector({x:w.x*v.scale,y:w.y*v.scale},v.rotation);return {x:v.offset.x+r.x,y:v.offset.y+r.y}}
 const limits={min:0.5,max:192}
 const initial:View={scale:48,rotation:0.3,offset:{x:-40,y:25}}
 it('sem mudança nos dedos, a vista não muda',()=>{
  const pose=gesturePose({x:-50,y:10},{x:70,y:-30}),v=applyGesture(initial,pose,pose,limits)
  expect(v.scale).toBeCloseTo(48);expect(v.rotation).toBeCloseTo(0.3);expect(v.offset.x).toBeCloseTo(-40);expect(v.offset.y).toBeCloseTo(25)
 })
 it('mantém o ponto do mundo sob o centro dos dedos ao dar zoom, girar e arrastar ao mesmo tempo',()=>{
  const a={x:-80,y:20},b={x:60,y:-40},from=gesturePose(a,b)
  const world=screenToLayer(initial,from.center)
  // dedos: afastam (zoom 1,6×), giram 35° e o centro anda (30, -20)
  const to=gesturePose({x:-120,y:10},{x:100,y:-60}),v=applyGesture(initial,from,to,limits)
  const scr=toScreen(v,world);expect(scr.x).toBeCloseTo(to.center.x,6);expect(scr.y).toBeCloseTo(to.center.y,6)
  expect(v.scale).toBeCloseTo(48*to.distance/from.distance);expect(v.rotation).toBeCloseTo(wrapAngle(0.3+(to.angle-from.angle)))
 })
 it('só girar (distância e centro iguais) gira em torno do centro dos dedos',()=>{
  const from=gesturePose({x:-50,y:0},{x:50,y:0}),to=gesturePose({x:0,y:-50},{x:0,y:50}) // 90° horário
  const v=applyGesture({scale:30,rotation:0,offset:{x:10,y:20}},from,to,limits)
  expect(v.rotation).toBeCloseTo(Math.PI/2);expect(v.scale).toBeCloseTo(30)
  const w=screenToLayer({scale:30,rotation:0,offset:{x:10,y:20}},from.center),s=toScreen(v,w);expect(s.x).toBeCloseTo(0);expect(s.y).toBeCloseTo(0)
 })
 it('respeita os limites de zoom e gruda em norte quando a rotação fica perto de zero',()=>{
  const from=gesturePose({x:-10,y:0},{x:10,y:0}),wide=gesturePose({x:-1e4,y:0},{x:1e4,y:0}),tiny=gesturePose({x:-0.01,y:0},{x:0.01,y:0})
  expect(applyGesture({scale:48,rotation:0,offset:{x:0,y:0}},from,wide,limits).scale).toBe(192);expect(applyGesture({scale:48,rotation:0,offset:{x:0,y:0}},from,tiny,limits).scale).toBe(0.5)
  const nearZero=gesturePose({x:-10,y:-0.4},{x:10,y:0.4}) // ~2,3° de giro
  expect(applyGesture({scale:48,rotation:0,offset:{x:0,y:0}},from,nearZero,limits,4*Math.PI/180).rotation).toBe(0)
  expect(applyGesture({scale:48,rotation:0,offset:{x:0,y:0}},from,nearZero,limits).rotation).toBeCloseTo(0.04,2)
 })
 it('com dedos juntos (distância zero) só desloca, sem zoom nem giro',()=>{
  const from=gesturePose({x:5,y:5},{x:5,y:5}),to=gesturePose({x:15,y:25},{x:15,y:25}),v=applyGesture(initial,from,to,limits)
  expect(v.scale).toBe(48);expect(v.rotation).toBe(0.3)
 })
 it('gira em torno de um ponto da tela mantendo-o parado (roda do mouse com Shift)',()=>{
  const pivot={x:90,y:-30},v0:View={scale:40,rotation:-0.5,offset:{x:15,y:-12}},world=screenToLayer(v0,pivot)
  const v=rotateAbout(v0,0.7,pivot),s=toScreen(v,world);expect(s.x).toBeCloseTo(pivot.x);expect(s.y).toBeCloseTo(pivot.y);expect(v.rotation).toBeCloseTo(0.2)
  expect(rotateAbout({scale:40,rotation:0.03,offset:{x:0,y:0}},-0.02,{x:0,y:0},4*Math.PI/180).rotation).toBe(0)
 })
 it('converte um toque na tela em coordenadas do mundo, com giro',()=>{
  const v:View={scale:48,rotation:Math.PI/2,offset:{x:100,y:0}}
  // origem do mundo em (100, 0); o mundo está girado 90° horário: o eixo +x do mundo aponta para baixo na tela
  const w=screenToLayer(v,{x:100,y:96});expect(w.x).toBeCloseTo(2);expect(w.y).toBeCloseTo(0)
  const back=toScreen(v,{x:2,y:0});expect(back.x).toBeCloseTo(100);expect(back.y).toBeCloseTo(96)
  expect(wrapAngle(3*Math.PI)).toBeCloseTo(Math.PI);expect(wrapAngle(-Math.PI/2)).toBeCloseTo(-Math.PI/2)
 })
})
