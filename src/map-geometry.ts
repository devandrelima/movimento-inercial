import type {Point} from './tracker'

export const ALIGN_THRESHOLD=1.0
export const ALIGN_PROVISIONAL=0.3
export type Alignment={points:Point[];anchorIndex:number;final:boolean}
/**
 * The first sufficiently long estimated displacement defines the initial forward direction.
 * This only works if the user begins by walking straight; it is not a compass.
 * To start drawing earlier, once the path is 30 cm long the farthest point so far gives a provisional direction
 * (re-evaluated at every new point, so the drawing turns a little at a time instead of jumping); the first point
 * 1 m away becomes the final anchor and freezes the direction. Measured on real walking starts, the direction error
 * is ~15° at 25 cm, ~9° at 75 cm and ~6° at 1 m. `anchorIndex`/`final` let callers detect changes.
 */
export function alignInfo(points:Point[], threshold=ALIGN_THRESHOLD, provisional=ALIGN_PROVISIONAL):Alignment | null {
  const origin=points[0]
  if (!origin) return null
  const far=(limit:number)=>points.findIndex(p=>Math.hypot(p.x-origin.x,p.y-origin.y)>=limit)
  let anchorIndex=far(threshold),final=anchorIndex>=0
  if (!final) {
    let best=0
    points.forEach((p,i)=>{const d=Math.hypot(p.x-origin.x,p.y-origin.y);if(d>best){best=d;anchorIndex=i}})
    if (best<Math.min(provisional,threshold)) return null
  }
  const anchor=points[anchorIndex],dx=anchor.x-origin.x,dy=anchor.y-origin.y,length=Math.hypot(dx,dy)
  return {anchorIndex,final,points:points.map(p=>({x:(dy*(p.x-origin.x)-dx*(p.y-origin.y))/length,y:(dx*(p.x-origin.x)+dy*(p.y-origin.y))/length}))}
}
export function alignForward(points:Point[], threshold=ALIGN_THRESHOLD, provisional=ALIGN_PROVISIONAL):Point[] | null {
  return alignInfo(points,threshold,provisional)?.points ?? null
}
export function zoomOffset(offset:Point, anchor:Point, ratio:number):Point {
  return {x:anchor.x-(anchor.x-offset.x)*ratio,y:anchor.y-(anchor.y-offset.y)*ratio}
}

/**
 * Direção em que a trajetória está apontando na sua ponta, em graus para `rotate()` do SVG
 * (0° = direita; eixo Y da tela para baixo, então 90° = para baixo). Usa a corda entre a última
 * posição e a posição mais recente que esteja pelo menos `minDistance` metros para trás, o que
 * suaviza o ruído de passos curtos e mantém a última direção enquanto o usuário está parado.
 * Devolve null se a trajetória ainda não andou o suficiente para ter direção.
 */
export function headingAngle(points:Point[], minDistance=0.25, minMovement=0.05):number | null {
  const last=points[points.length-1]
  if (!last) return null
  let anchor:Point | null=null,farthest=0
  for (let i=points.length-2;i>=0;i--) {
    const d=Math.hypot(last.x-points[i].x,last.y-points[i].y)
    if (d>farthest) {farthest=d;anchor=points[i]}
    if (d>=minDistance) break
  }
  if (!anchor || farthest<minMovement) return null
  return Math.atan2(-(last.y-anchor.y),last.x-anchor.x)*180/Math.PI
}

const GRID_STEPS=[1,2,5,10,20,50,100,200,500]
/** Menor lado de quadrícula (metros) cuja célula tenha pelo menos `minPixels` na tela; evita uma grade ilegível ao afastar. */
export function gridStep(pixelsPerMeter:number, minPixels=10):number {
  return GRID_STEPS.find(step=>step*pixelsPerMeter>=minPixels) ?? GRID_STEPS[GRID_STEPS.length-1]
}

/**
 * Escala inicial (pixels por metro) e deslocamento do mapa para uma sala. Se a sala cabe na área no zoom padrão,
 * mantém o padrão (origem no centro). Se não cabe, afasta até ela caber, com folga, e a centraliza.
 */
export function initialView(room:{width:number;height:number;start:Point}, boxWidth:number, boxHeight:number, defaultScale:number, minScale:number):{scale:number;offset:Point} {
  const fits=room.width*defaultScale<=boxWidth*0.95 && room.height*defaultScale<=boxHeight*0.95
  if (fits || boxWidth<=0 || boxHeight<=0) return {scale:defaultScale,offset:{x:0,y:0}}
  const scale=Math.max(minScale,Math.min(defaultScale,0.9*Math.min(boxWidth/room.width,boxHeight/room.height)))
  return {scale,offset:{x:-(room.width/2-room.start.x)*scale,y:(room.height/2-room.start.y)*scale}}
}

// ---------- Vista do mapa: zoom, giro e deslocamento ----------
/** Vista: tela = centro + offset + R(rotation) · (scale · mundo). `rotation` em radianos, sentido horário na tela (eixo Y para baixo). */
export type View={scale:number;rotation:number;offset:Point}
export type GesturePose={center:Point;distance:number;angle:number}
const TWO_PI=Math.PI*2
/** Leva um ângulo para (-π, π]. */
export const wrapAngle=(angle:number)=>{const a=((angle+Math.PI)%TWO_PI+TWO_PI)%TWO_PI-Math.PI;return a===-Math.PI?Math.PI:a}
/** Gira o vetor `v` por `angle` (horário na tela). */
export const rotateVector=(v:Point,angle:number):Point=>{const c=Math.cos(angle),s=Math.sin(angle);return {x:c*v.x-s*v.y,y:s*v.x+c*v.y}}

/** Pose de dois ponteiros: ponto médio, distância e ângulo do segmento entre eles. */
export function gesturePose(a:Point,b:Point):GesturePose {
  return {center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.hypot(a.x-b.x,a.y-b.y),angle:Math.atan2(b.y-a.y,b.x-a.x)}
}

/**
 * Vista depois de um gesto de dois dedos: o zoom segue a razão entre as distâncias, o giro segue a diferença de
 * ângulo, e o deslocamento é tal que o ponto do mundo que estava sob o centro inicial dos dedos fica sob o centro atual.
 * Se a rotação final cai a menos de `snap` radianos de zero, ela gruda em zero (facilita voltar a "norte para cima").
 */
export function applyGesture(initial:View, from:GesturePose, to:GesturePose, limits:{min:number;max:number}, snap=0):View {
  const scale=from.distance>0?Math.max(limits.min,Math.min(limits.max,initial.scale*to.distance/from.distance)):initial.scale
  let rotation=from.distance>0?wrapAngle(initial.rotation+(to.angle-from.angle)):initial.rotation
  if (snap>0 && Math.abs(rotation)<snap) rotation=0
  const ratio=scale/initial.scale,moved=rotateVector({x:from.center.x-initial.offset.x,y:from.center.y-initial.offset.y},rotation-initial.rotation)
  return {scale,rotation,offset:{x:to.center.x-ratio*moved.x,y:to.center.y-ratio*moved.y}}
}

/** Gira a vista por `delta` em torno de um ponto da tela (relativo ao centro), mantendo esse ponto parado. */
export function rotateAbout(view:View, delta:number, pivot:Point, snap=0):View {
  let rotation=wrapAngle(view.rotation+delta)
  if (snap>0 && Math.abs(rotation)<snap) rotation=0
  const moved=rotateVector({x:pivot.x-view.offset.x,y:pivot.y-view.offset.y},rotation-view.rotation)
  return {scale:view.scale,rotation,offset:{x:pivot.x-moved.x,y:pivot.y-moved.y}}
}

/** Ponto do mundo (pixels da camada, Y para baixo) sob um ponto da tela relativo ao centro. */
export function screenToLayer(view:View, p:Point):Point {
  return rotateVector({x:(p.x-view.offset.x)/view.scale,y:(p.y-view.offset.y)/view.scale},-view.rotation)
}

/**
 * Fator de escala para que uma área `width × height` girada por `angle` (radianos) continue inteira dentro da área
 * original (a vista girada do editor). 1 sem rotação; 1/√2 para um quadrado girado 45°.
 */
export function fitScaleForRotation(width:number, height:number, angle:number):number {
  const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle))
  if (width<=0 || height<=0) return 1
  return Math.min(1,width/(width*c+height*s),height/(width*s+height*c))
}
