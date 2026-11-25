export const columns = ['tipo','hora_unix_ms','tempo_monotonico_ms','intervalo_ms','acel_x_m_s2','acel_y_m_s2','acel_z_m_s2','gravidade_x_m_s2','gravidade_y_m_s2','gravidade_z_m_s2','rot_alpha_graus_s','rot_beta_graus_s','rot_gamma_graus_s','gyro_x_rad_s','gyro_y_rad_s','gyro_z_rad_s','erro','sensor_x','sensor_y','sensor_z','sensor_unidade','orient_alpha_graus','orient_beta_graus','orient_gamma_graus','orient_absoluta'] as const
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
  return ['devicemotion',wall,time,event.interval,a?.x,a?.y,a?.z,g?.x,g?.y,g?.z,r?.alpha,r?.beta,r?.gamma,null,null,null,null]
}
