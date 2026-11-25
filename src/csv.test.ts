import {it,expect} from 'vitest'
import {encodeCsv,motionRow,orientationRow,sessionRow} from './csv'
it('exporta valores brutos, lacunas e erros escapados',()=>{
 const event={acceleration:{x:1,y:null,z:3},accelerationIncludingGravity:{x:4,y:5,z:6},rotationRate:null,interval:16} as unknown as DeviceMotionEvent
 const row=motionRow(event,12,123); expect(row.slice(4,13)).toEqual([1,null,3,4,5,6,undefined,undefined,undefined])
 expect(encodeCsv([row,['erro',123,12,null,null,null,null,null,null,null,null,null,null,null,null,null,'erro, "teste"']])).toContain('"erro, ""teste"""')
})
it('registra orientação relativa e marcadores sem misturar horários',()=>{
 const event={alpha:12.5,beta:-3,gamma:null,absolute:false} as DeviceOrientationEvent
 const row=orientationRow(event,200,1000)
 expect(row.slice(0,3)).toEqual(['deviceorientation',1000,200])
 expect(row.slice(13)).toEqual([12.5,-3,null,'false'])
 expect(sessionRow('pausa',201,1001)).toEqual(['pausa',1001,201])
})
