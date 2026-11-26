import {expect,it} from 'vitest'
import {SensorCheck} from './sensor-check'
const motion=(gyro=true)=>({accelerationIncludingGravity:{x:0,y:0,z:9.8},rotationRate:gyro?{alpha:0,beta:0,gamma:0}:null} as DeviceMotionEvent)
const orientation=({alpha:0,beta:0,gamma:0,absolute:false} as DeviceOrientationEvent)
it('exige todos os sinais e frequência suficiente',()=>{
 const check=new SensorCheck()
 for(let i=0;i<180;i++){check.motion(motion(),i*1000/60);if(i%3===0)check.orientationEvent(orientation,i*1000/60)}
 expect(check.result().compatible).toBe(true)
})
it('informa o giroscópio ausente',()=>{
 const check=new SensorCheck();for(let i=0;i<120;i++){check.motion(motion(false),i*1000/60);check.orientationEvent(orientation,i*1000/60)}
 expect(check.result()).toMatchObject({compatible:false,missing:['giroscópio']})
})
it('rejeita baixa frequência e orientação vazia',()=>{
 const low=new SensorCheck();for(let i=0;i<90;i++){low.motion(motion(),i*1000/30);low.orientationEvent(orientation,i*1000/30)}
 expect(low.result().missing).toContain('frequência de movimento inferior a 50 Hz')
 const empty=new SensorCheck();for(let i=0;i<180;i++)empty.motion(motion(),i*1000/60)
 expect(empty.result().missing).toContain('orientação')
})
