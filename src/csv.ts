import type { PreparedSample } from './preprocess'
export const columns = ['tipo','hora_unix_ms','tempo_monotonico_ms','intervalo_ms','acel_x_m_s2','acel_y_m_s2','acel_z_m_s2','gravidade_x_m_s2','gravidade_y_m_s2','gravidade_z_m_s2','rot_alpha_graus_s','rot_beta_graus_s','rot_gamma_graus_s','orient_alpha_graus','orient_beta_graus','orient_gamma_graus','orient_absoluta','orient_tempo_monotonico_ms'] as const
export type Row = (number | string | null | undefined)[]
export function encodeCsv(rows: Row[]): string {
  const escape = (value: Row[number]) => {
    if (value == null) return ''
    const v = String(value)
    return /[",\r\n]/.test(v) ? `"${v.replaceAll('"','""')}"` : v
  }
  return [columns.join(','),...rows.map(row=>row.map(escape).join(','))].join('\r\n') + '\r\n'
}
export function motionRow(event: DeviceMotionEvent, time: number, wall: number): Row {
  const a=event.acceleration, g=event.accelerationIncludingGravity, r=event.rotationRate
  return ['devicemotion',wall,time,event.interval,a?.x,a?.y,a?.z,g?.x,g?.y,g?.z,r?.alpha,r?.beta,r?.gamma]
}

export function orientationRow(event: DeviceOrientationEvent, time: number, wall: number): Row {
  return ['deviceorientation',wall,time,null,null,null,null,null,null,null,null,null,null,event.alpha,event.beta,event.gamma,event.absolute === true ? 'true' : 'false',time]
}
export function sessionRow(kind: 'inicio'|'pausa', time: number, wall: number): Row { return [kind,wall,time] }

/** Filtered acceleration in m/s²; rotation converted back to deg/s for CSV compatibility. */
export function preparedRow(sample: PreparedSample, wall: number): Row {
  const degrees=180/Math.PI, o=sample.orientation
  return ['imu_50hz',wall,sample.time,20,null,null,null,sample.acceleration.x,sample.acceleration.y,sample.acceleration.z,sample.rotation.x*degrees,sample.rotation.y*degrees,sample.rotation.z*degrees,o?.alpha,o?.beta,o?.gamma,o ? String(o.absolute) : null,o?.time]
}
