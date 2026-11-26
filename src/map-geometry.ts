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
