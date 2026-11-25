import {describe,expect,it} from 'vitest'
import {MotionPreprocessor,PREPROCESS} from './preprocess'
import type {PartialSample} from './sensors'
const frame=(time:number,x=1):PartialSample=>({time,acceleration:{x,y:2,z:9.8},rotation:{x:0.1,y:0.2,z:0.3}})
describe('pré-processamento a 50 Hz',()=>{
 it('forma janelas de 100 amostras regulares a partir de 60 Hz',()=>{
  const p=new MotionPreprocessor(); let window=null; let outputs=0
  for(let i=0;i<=240;i++){const result=p.push(frame(i*1000/60));outputs+=result.samples.length; if(result.window)window=result.window}
  expect(outputs).toBeGreaterThan(100); expect(window).not.toBeNull(); expect(window!.samples).toHaveLength(100)
  for(let i=1;i<window!.samples.length;i++)expect(window!.samples[i].time-window!.samples[i-1].time).toBeCloseTo(20)
  expect(window!.samples[0].acceleration.x).toBeCloseTo(1)
 })
 it('não gera janelas quando a frequência recebida é inferior a 50 Hz',()=>{
  const p=new MotionPreprocessor();let windows=0,low=false
  for(let i=0;i<180;i++){const r=p.push(frame(i*1000/30));if(r.window)windows++;if(r.state==='low-rate')low=true}
  expect(low).toBe(true);expect(windows).toBe(0)
 })
 it('descarta janela em formação após lacuna ou sensor ausente',()=>{
  const p=new MotionPreprocessor();for(let i=0;i<170;i++)p.push(frame(i*1000/60))
  expect(p.push(frame(4000)).state).toBe('gap')
  expect(p.push({time:4017,acceleration:{x:null,y:0,z:0},rotation:{x:0,y:0,z:0}}).state).toBe('missing')
  let window=null;for(let i=0;i<100;i++){window=p.push(frame(5000+i*1000/60)).window??window}expect(window).toBeNull()
 })
 it('não usa orientação futura ou vencida',()=>{
  const p=new MotionPreprocessor();p.addOrientation({time:2000,alpha:10,beta:20,gamma:30,absolute:false})
  const samples=[];for(let i=0;i<=210;i++)samples.push(...p.push(frame(i*1000/60)).samples)
  expect(samples.find(s=>s.time<2000)?.orientation).toBeNull()
  expect(samples.find(s=>s.time>=2000 && s.time<2500)?.orientation?.alpha).toBe(10)
  expect(samples.find(s=>s.time>2500)?.orientation).toBeNull()
 })
 it('atenua uma oscilação acima do limite de 25 Hz',()=>{
  const p=new MotionPreprocessor();const values:number[]=[]
  for(let i=0;i<600;i++){const t=i*1000/60;for(const sample of p.push(frame(t,Math.sin(2*Math.PI*29*t/1000))).samples)values.push(sample.acceleration.x)}
  const rms=Math.sqrt(values.reduce((sum,x)=>sum+x*x,0)/values.length)
  expect(rms).toBeLessThan(0.15)
 })
 it('reinicia estado para não misturar uma pausa',()=>{
  const p=new MotionPreprocessor();for(let i=0;i<200;i++)p.push(frame(i*1000/60));p.reset()
  let ready=false;for(let i=0;i<120;i++)if(p.push(frame(10000+i*1000/60)).window)ready=true
  expect(ready).toBe(false);expect(PREPROCESS.windowSize).toBe(100)
 })
})
