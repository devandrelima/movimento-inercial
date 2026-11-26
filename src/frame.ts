import type { OrientationSample, Vector } from './sensors'
import type { PreparedSample } from './preprocess'

type Matrix = [number[],number[],number[]]
export type LocalFrame = { yaw: number; absolute: boolean }

/** W3C intrinsic Z-X'-Y'' rotation; orientation must use the same reference throughout. */
export function orientationMatrix(o: OrientationSample): Matrix {
  if (![o.alpha,o.beta,o.gamma].every(v=>typeof v==='number' && Number.isFinite(v))) throw new Error('Orientação incompleta')
  const a=o.alpha!*Math.PI/180,b=o.beta!*Math.PI/180,g=o.gamma!*Math.PI/180
  const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g)
  return [[ca*cg-sa*sb*sg,-sa*cb,ca*sg+sa*sb*cg],[sa*cg+ca*sb*sg,ca*cb,sa*sg-ca*sb*cg],[-cb*sg,sb,cb*cg]]
}
export function initializeFrame(o: OrientationSample): LocalFrame {
  const m=orientationMatrix(o)
  if (Math.hypot(m[0][0],m[1][0])<1e-6) throw new Error('Não é possível inicializar: eixo do aparelho na vertical')
  return {yaw:Math.atan2(m[1][0],m[0][0]),absolute:o.absolute}
}
function rotate(m:Matrix, frame:LocalFrame, v:Vector): Vector {
  const x=m[0][0]*v.x+m[0][1]*v.y+m[0][2]*v.z
  const y=m[1][0]*v.x+m[1][1]*v.y+m[1][2]*v.z
  const z=m[2][0]*v.x+m[2][1]*v.y+m[2][2]*v.z
  const c=Math.cos(frame.yaw),s=Math.sin(frame.yaw)
  return {x:c*x+s*y,y:-s*x+c*y,z}
}
/** The incoming gyro axes are already X/Y/Z in rad/s, verified on one browser. */
export function localChannels(sample:PreparedSample,frame:LocalFrame): number[] {
  const o=sample.orientation
  if (!o || o.absolute!==frame.absolute || sample.time-o.time<0 || sample.time-o.time>500) throw new Error('Orientação insuficiente ou alterada')
  const matrix=orientationMatrix(o),a=rotate(matrix,frame,sample.acceleration),g=rotate(matrix,frame,sample.rotation)
  const result=[a.x,a.y,a.z,g.x,g.y,g.z]
  if (!result.every(Number.isFinite)) throw new Error('Amostra inválida')
  return result
}
export function modelInput(samples:PreparedSample[],frame:LocalFrame):Float32Array {
  if (samples.length!==100) throw new Error('Janela incompleta')
  const values=new Float32Array(600)
  samples.forEach((sample,index)=>values.set(localChannels(sample,frame),index*6))
  return values
}
