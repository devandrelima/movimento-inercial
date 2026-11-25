export type Vector = { x: number; y: number; z: number }
export type Sample = { time: number; acceleration: Vector; rotation: Vector }
const vector = (v: {x: number | null; y: number | null; z: number | null} | null): Vector | null => {
  if (!v || v.x == null || v.y == null || v.z == null || ![v.x,v.y,v.z].every(Number.isFinite)) return null
  return {x:v.x,y:v.y,z:v.z}
}
/** Browser rotationRate: beta=x, gamma=y, alpha=z, degrees/s. */
export function readMotion(event: DeviceMotionEvent, time = performance.now()): Sample | null {
  const acceleration = vector(event.accelerationIncludingGravity)
  const r = event.rotationRate
  const degrees = r ? vector({x:r.beta,y:r.gamma,z:r.alpha}) : null
  if (!acceleration || !degrees || !Number.isFinite(time)) return null
  const factor = Math.PI / 180
  return {time, acceleration, rotation:{x:degrees.x*factor,y:degrees.y*factor,z:degrees.z*factor}}
}
export function samplingHz(samples: Sample[]): number | null {
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
