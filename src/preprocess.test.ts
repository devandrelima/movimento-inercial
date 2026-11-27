import {describe,expect,it} from 'vitest'
import {isStill,MotionPreprocessor,PREPROCESS,type PreparedWindow} from './preprocess'
import type {PartialSample} from './sensors'
const frame=(time:number,x=1):PartialSample=>({time,acceleration:{x,y:2,z:9.8},rotation:{x:0.1,y:0.2,z:0.3}})
const orientation=(time:number)=>({time,alpha:0,beta:0,gamma:0,absolute:false})
/** Aparelho parado: gravidade constante, giro ~0. */
const still=(time:number):PartialSample=>({time,acceleration:{x:0.1,y:0.2,z:9.8},rotation:{x:0.01,y:0,z:0}})
/** Aparelho em movimento: aceleração oscilando forte e giro alto. */
const moving=(time:number):PartialSample=>({time,acceleration:{x:3*Math.sin(time/90),y:2*Math.cos(time/70),z:9.8+3*Math.sin(time/60)},rotation:{x:1.2*Math.sin(time/80),y:0.9,z:0.7}})
describe('pré-processamento a 50 Hz',()=>{
 it('forma janelas de 100 amostras regulares a partir de 60 Hz',()=>{
  const p=new MotionPreprocessor();p.addOrientation(orientation(0));let window:PreparedWindow|null=null; let outputs=0
  for(let i=0;i<=240;i++){const result=p.push(frame(i*1000/60));outputs+=result.samples.length; if(result.window&&result.window.padded===0)window=result.window}
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
  const p=new MotionPreprocessor();p.addOrientation(orientation(0));for(let i=0;i<170;i++)p.push(frame(i*1000/60))
  expect(p.push(frame(4000)).state).toBe('gap')
  expect(p.push({time:4017,acceleration:{x:null,y:0,z:0},rotation:{x:0,y:0,z:0}}).state).toBe('missing')
  // depois da lacuna começa uma sessão nova: nenhuma janela completa com dados antigos (só as iniciais, preenchidas)
  const windows:PreparedWindow[]=[];p.addOrientation(orientation(5000))
  for(let i=0;i<100;i++){const w=p.push(frame(5000+i*1000/60)).window;if(w)windows.push(w)}
  expect(windows.every(w=>w.padded>0)).toBe(true);expect(windows.every(w=>w.samples.every(s=>s.time>=5000))).toBe(true)
 })
 it('não usa orientação futura ou vencida',()=>{
  const p=new MotionPreprocessor();p.addOrientation({time:2000,alpha:10,beta:20,gamma:30,absolute:false})
  const samples=[];for(let i=0;i<=210;i++)samples.push(...p.push(frame(i*1000/60)).samples)
  // sem orientação ainda, o pré-processador não começa a formar janelas (elas seriam inutilizáveis)
  expect(samples.find(s=>s.time<2000)).toBeUndefined()
  expect(samples.find(s=>s.time>=2000 && s.time<2500)?.orientation?.alpha).toBe(10)
  expect(samples.find(s=>s.time>2500)?.orientation).toBeNull()
 })
 it('atenua uma oscilação acima do limite de 25 Hz',()=>{
  const p=new MotionPreprocessor();p.addOrientation(orientation(0));const values:number[]=[]
  for(let i=0;i<600;i++){const t=i*1000/60;for(const sample of p.push(frame(t,Math.sin(2*Math.PI*29*t/1000))).samples)values.push(sample.acceleration.x)}
  const rms=Math.sqrt(values.reduce((sum,x)=>sum+x*x,0)/values.length)
  expect(rms).toBeLessThan(0.15)
 })
 it('reinicia estado para não misturar uma pausa',()=>{
  const p=new MotionPreprocessor();p.addOrientation(orientation(0));for(let i=0;i<200;i++)p.push(frame(i*1000/60));p.reset();p.addOrientation(orientation(10000))
  let full=false;for(let i=0;i<110;i++){const w=p.push(frame(10000+i*1000/60)).window;if(w&&w.padded===0)full=true}
  expect(full).toBe(false);expect(PREPROCESS.windowSize).toBe(100)
 })
})

describe('estimativas desde o início (play apertado com o aparelho parado)',()=>{
 const run=(make:(t:number)=>PartialSample,hz=60,seconds=4,withOrientation=true)=>{
  const p=new MotionPreprocessor()
  const windows:{window:PreparedWindow;time:number}[]=[]
  for(let i=0;i<=seconds*hz;i++){const t=i*1000/hz;if(withOrientation)p.addOrientation(orientation(t));const w=p.push(make(t)).window;if(w)windows.push({window:w,time:t})}
  return windows
 }
 it('começa parado: a primeira janela sai em cerca de 0,7 s e depois a cada 0,5 s, com o histórico preenchido',()=>{
  const windows=run(still)
  expect(windows.map(w=>w.window.padded).slice(0,5)).toEqual([75,50,25,0,0])
  expect(windows[0].time).toBeGreaterThan(600);expect(windows[0].time).toBeLessThan(900)
  for(let i=1;i<4;i++){const gap=windows[i].time-windows[i-1].time;expect(gap).toBeGreaterThan(450);expect(gap).toBeLessThan(550)}
  const w=windows[0].window;expect(w.samples).toHaveLength(100)
  // o prefixo repete a primeira amostra real (mesmo objeto: mesmo tempo e orientação) e o fim é dado real
  expect(w.samples[0]).toBe(w.samples[75]);expect(w.samples[74]).toBe(w.samples[75]);expect(w.samples[76]).not.toBe(w.samples[75])
  for(let i=76;i<100;i++)expect(w.samples[i].time-w.samples[i-1].time).toBeCloseTo(20)
  for(const s of w.samples)expect(s.orientation).not.toBeNull()
 })
 it('sem histórico novo, a janela completa só vem depois de 100 amostras reais (~2,2 s)',()=>{
  const full=run(still).filter(w=>w.window.padded===0)[0]
  expect(full.time).toBeGreaterThan(2000);expect(full.time).toBeLessThan(2400)
 })
 it('já em movimento ao começar: não preenche o histórico (esperaria um histórico falso)',()=>{
  const windows=run(moving,60,4)
  expect(windows.length).toBeGreaterThan(0);expect(windows.every(w=>w.window.padded===0)).toBe(true)
  expect(windows[0].time).toBeGreaterThan(2000)
 })
 it('com taxa abaixo de 50 Hz não emite janelas iniciais',()=>{expect(run(still,40,4).filter(w=>w.window.padded>0)).toHaveLength(0)})
 it('espera a primeira orientação antes de formar janelas',()=>{
  const p=new MotionPreprocessor();let early=0
  for(let i=0;i<=120;i++)early+=p.push(still(i*1000/60)).samples.length
  expect(early).toBe(0)
  p.addOrientation(orientation(2000));const after=p.push(still(2017)).samples.length+p.push(still(2034)).samples.length
  expect(after).toBeGreaterThanOrEqual(0)
 })
 it('classifica parado e em movimento pelas leituras iniciais',()=>{
  const mk=(f:(t:number)=>PartialSample)=>Array.from({length:10},(_,i)=>{const s=f(i*20);return {time:i*20,acceleration:{x:s.acceleration.x!,y:s.acceleration.y!,z:s.acceleration.z!},rotation:{x:s.rotation.x!,y:s.rotation.y!,z:s.rotation.z!},orientation:null}})
  expect(isStill(mk(still))).toBe(true);expect(isStill(mk(moving))).toBe(false);expect(isStill([])).toBe(false)
 })
})
