import {readMotion,readOrientation} from './sensors'

export class SensorCheck {
  private motionTimes:number[]=[]
  private acceleration=0
  private gyro=0
  private orientation=0
  motion(event:DeviceMotionEvent,time:number) {
    const a=event.accelerationIncludingGravity,r=event.rotationRate
    const valid=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)
    if(a&&[a.x,a.y,a.z].every(valid))this.acceleration++
    if(r&&[r.alpha,r.beta,r.gamma].every(valid))this.gyro++
    if(readMotion(event,time))this.motionTimes.push(time)
  }
  orientationEvent(event:DeviceOrientationEvent,time:number) {
    const o=readOrientation(event,time)
    if([o.alpha,o.beta,o.gamma].every(x=>x!==null))this.orientation++
  }
  result() {
    const times=this.motionTimes,span=times.length>1?times[times.length-1]-times[0]:0
    const hz=span>=1000?(times.length-1)*1000/span:null
    const missing:string[]=[]
    if(this.acceleration<3)missing.push('acelerômetro')
    if(this.gyro<3)missing.push('giroscópio')
    if(this.orientation<3)missing.push('orientação')
    if(!missing.length && (hz===null || hz<50))missing.push('frequência de movimento inferior a 50 Hz')
    return {compatible:missing.length===0,missing,hz}
  }
}
