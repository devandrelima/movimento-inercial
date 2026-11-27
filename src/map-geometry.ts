import type {Point} from './tracker'

// The first sufficiently long estimated displacement defines the initial forward direction.
// This only works if the user begins by walking straight; it is not a compass.
export function alignForward(points:Point[], threshold=0.75):Point[] | null {
  const origin=points[0]
  if (!origin) return null
  const anchor=points.find(p=>Math.hypot(p.x-origin.x,p.y-origin.y)>=threshold)
  if (!anchor) return null
  const dx=anchor.x-origin.x,dy=anchor.y-origin.y,length=Math.hypot(dx,dy)
  return points.map(p=>({x:(dy*(p.x-origin.x)-dx*(p.y-origin.y))/length,y:(dx*(p.x-origin.x)+dy*(p.y-origin.y))/length}))
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
