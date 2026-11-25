export type Vector = { x: number; y: number; z: number }
export type PartialVector = { x: number | null; y: number | null; z: number | null }
export type PartialSample = { time: number; acceleration: PartialVector; rotation: PartialVector }
const finite = (n: number | null | undefined): number | null => typeof n === 'number' && Number.isFinite(n) ? n : null
export function readPartialMotion(event: DeviceMotionEvent, time = performance.now()): PartialSample {
  const a = event.accelerationIncludingGravity
  const r = event.rotationRate
  const rad = (n: number | null | undefined) => { const value = finite(n); return value === null ? null : value * Math.PI / 180 }
  return {time, acceleration:{x:finite(a?.x),y:finite(a?.y),z:finite(a?.z)}, rotation:{x:rad(r?.alpha),y:rad(r?.beta),z:rad(r?.gamma)}}
}
export type Sample = { time: number; acceleration: Vector; rotation: Vector }
const vector = (v: {x: number | null; y: number | null; z: number | null} | null): Vector | null => {
  if (!v || v.x == null || v.y == null || v.z == null || ![v.x,v.y,v.z].every(Number.isFinite)) return null
  return {x:v.x,y:v.y,z:v.z}
}
/** W3C DeviceMotionEvent rotationRate: alpha=x, beta=y, gamma=z, degrees/s. */
export function readMotion(event: DeviceMotionEvent, time = performance.now()): Sample | null {
  const acceleration = vector(event.accelerationIncludingGravity)
  const r = event.rotationRate
  const degrees = r ? vector({x:r.alpha,y:r.beta,z:r.gamma}) : null
  if (!acceleration || !degrees || !Number.isFinite(time)) return null
  const factor = Math.PI / 180
  return {time, acceleration, rotation:{x:degrees.x*factor,y:degrees.y*factor,z:degrees.z*factor}}
}
export function samplingHz(samples: {time:number}[]): number | null {
  if (samples.length < 2) return null
  const duration = samples[samples.length-1].time - samples[0].time
  return duration > 0 ? (samples.length-1)*1000/duration : null
}
export async function motionPermission(): Promise<'granted'|'denied'|'unavailable'> {
  if (!window.isSecureContext || typeof DeviceMotionEvent === 'undefined') return 'unavailable'
  const klass = DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?: () => Promise<string>}
  if (!klass.requestPermission) return 'granted'
  try { return await klass.requestPermission() === 'granted' ? 'granted' : 'denied' } catch { return 'denied' }
}

export type OrientationSample = { time: number; alpha: number | null; beta: number | null; gamma: number | null; absolute: boolean }
export function readOrientation(event: DeviceOrientationEvent, time = performance.now()): OrientationSample {
  return {time, alpha:finite(event.alpha), beta:finite(event.beta), gamma:finite(event.gamma), absolute:event.absolute === true}
}
/** Both requests start in the click handler before awaiting, preserving user activation. */
export function sensorPermissions(): Promise<{motion: 'granted'|'denied'|'unavailable'; orientation: 'granted'|'denied'|'unavailable'}> {
  const motion = motionPermission()
  const orientation = (() => {
    if (!window.isSecureContext || typeof DeviceOrientationEvent === 'undefined') return Promise.resolve('unavailable' as const)
    const klass = DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?: () => Promise<string>}
    if (!klass.requestPermission) return Promise.resolve('granted' as const)
    try { return klass.requestPermission().then(result => result === 'granted' ? 'granted' as const : 'denied' as const, () => 'denied' as const) }
    catch { return Promise.resolve('denied' as const) }
  })()
  return Promise.all([motion,orientation]).then(([m,o]) => ({motion:m,orientation:o}))
}
