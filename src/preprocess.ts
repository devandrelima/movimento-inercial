import type { OrientationSample, PartialSample, Vector } from './sensors'

/**
 * Provisional streaming contract. Training must implement and validate the same filter.
 * `warmupMs` is only the transient discarded after the filter starts (a 12 Hz 4-stage low-pass settles in well under
 * 200 ms); the delivery metadata uses 1 s, which just delayed the first estimate. `rateCheckMs` keeps the old 1 s
 * before declaring low rate. The `still*` fields decide whether the user was stationary when starting, which allows
 * early windows with a padded history (see MotionPreprocessor).
 */
export const PREPROCESS = { targetHz: 50, windowSize: 100, stride: 25, cutoffHz: 12, filterStages: 4, warmupMs: 200, rateCheckMs: 1000, maxGapMs: 75, orientationMaxAgeMs: 500, earlyMinSamples: 25, stillSamples: 10, stillAccStd: 0.4, stillGyro: 0.3 } as const
export type PreparedSample = { time: number; acceleration: Vector; rotation: Vector; orientation: OrientationSample | null }
export type PreprocessState = 'warming' | 'ready' | 'low-rate' | 'gap' | 'missing'
/** `padded` = how many leading samples repeat the first real one (0 for a full window of real data). */
export type PreparedWindow = { samples: PreparedSample[]; startTime: number; endTime: number; padded: number }
export type PreprocessResult = { samples: PreparedSample[]; window: PreparedWindow | null; state: PreprocessState }
type Frame = {time:number; values:number[]}
const stepMs = 1000 / PREPROCESS.targetHz
const finite = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value)

/** Was the device still? Low variation of |acceleration| and a small |rotation| over the first samples (m/s² and rad/s). */
export function isStill(samples: PreparedSample[]): boolean {
  if (!samples.length) return false
  const a=samples.map(s=>Math.hypot(s.acceleration.x,s.acceleration.y,s.acceleration.z)),mean=a.reduce((x,y)=>x+y,0)/a.length
  const std=Math.sqrt(a.reduce((x,y)=>x+(y-mean)**2,0)/a.length)
  const gyro=samples.reduce((x,s)=>x+Math.hypot(s.rotation.x,s.rotation.y,s.rotation.z),0)/samples.length
  return std<PREPROCESS.stillAccStd && gyro<PREPROCESS.stillGyro
}

/** Causal filter and time-based resampling; no output window crosses gaps or resets. */
export class MotionPreprocessor {
  private previous: Frame | null = null
  private stages: number[][] = []
  private times: number[] = []
  private nextTime = 0
  private started = 0
  private buffer: PreparedSample[] = []
  private sinceWindow = 0
  private orientations: OrientationSample[] = []
  private state: PreprocessState = 'warming'
  /** Was the device still at the start? null until the first `stillSamples` samples exist. */
  private startedStill: boolean | null = null

  reset(): void {
    this.previous = null; this.stages = []; this.times = []; this.nextTime = 0; this.started = 0
    this.buffer = []; this.sinceWindow = 0; this.orientations = []; this.state = 'warming'; this.startedStill = null
  }

  addOrientation(sample: OrientationSample): void {
    if (!Number.isFinite(sample.time) || ![sample.alpha,sample.beta,sample.gamma].every(finite)) return
    if (this.orientations.length && sample.time <= this.orientations[this.orientations.length-1].time) return
    this.orientations.push(sample)
    while (this.orientations.length > 1 && this.orientations[0].time < sample.time - 2000) this.orientations.shift()
  }

  private orientationAt(time: number): OrientationSample | null {
    for (let i=this.orientations.length-1;i>=0;i--) {
      const orientation=this.orientations[i]
      if (orientation.time <= time) return time-orientation.time <= PREPROCESS.orientationMaxAgeMs ? orientation : null
    }
    return null
  }

  push(input: PartialSample): PreprocessResult {
    const vector=[input.acceleration.x,input.acceleration.y,input.acceleration.z,input.rotation.x,input.rotation.y,input.rotation.z]
    if (!Number.isFinite(input.time) || !vector.every(finite)) {
      this.reset(); this.state='missing'; return {samples:[],window:null,state:this.state}
    }
    const values=vector as number[]
    if (this.previous && (input.time <= this.previous.time || input.time-this.previous.time > PREPROCESS.maxGapMs)) {
      this.reset(); this.state='gap'
    }
    if (!this.previous) {
      this.started=input.time; this.nextTime=input.time+stepMs; this.times=[input.time]
      this.stages=Array.from({length:PREPROCESS.filterStages},()=>values.slice())
      this.previous={time:input.time,values:values.slice()}
      return {samples:[],window:null,state:this.state}
    }
    const previous=this.previous, dt=input.time-previous.time
    const alpha=1-Math.exp(-2*Math.PI*PREPROCESS.cutoffHz*dt/1000)
    let signal=values
    for (const stage of this.stages) {
      for (let i=0;i<stage.length;i++) stage[i]+=alpha*(signal[i]-stage[i])
      signal=stage
    }
    const filtered=signal.slice()
    this.times.push(input.time)
    while (this.times.length>2 && this.times[1] < input.time-1000) this.times.shift()
    const measuredHz=(this.times.length-1)*1000/(input.time-this.times[0])
    if (input.time-this.started >= PREPROCESS.rateCheckMs && measuredHz < PREPROCESS.targetHz) {
      this.reset(); this.state='low-rate'; return {samples:[],window:null,state:this.state}
    }
    const samples: PreparedSample[]=[]
    let window: PreparedWindow | null=null
    while (this.nextTime <= input.time) {
      const fraction=(this.nextTime-previous.time)/dt
      const v=previous.values.map((old,i)=>old+(filtered[i]-old)*fraction)
      // Starts after the warm-up and, at the very beginning, once the first orientation exists (a window without it is unusable).
      const orientation=this.orientationAt(this.nextTime)
      if (this.nextTime-this.started >= PREPROCESS.warmupMs && (this.buffer.length>0 || orientation!==null)) {
        const sample: PreparedSample={time:this.nextTime,acceleration:{x:v[0],y:v[1],z:v[2]},rotation:{x:v[3],y:v[4],z:v[5]},orientation}
        samples.push(sample); this.buffer.push(sample)
        if (this.buffer.length>PREPROCESS.windowSize) this.buffer.shift()
        if (this.startedStill===null && this.buffer.length>=PREPROCESS.stillSamples) this.startedStill=isStill(this.buffer.slice(0,PREPROCESS.stillSamples))
        this.sinceWindow++
        if (this.sinceWindow>=PREPROCESS.stride) {
          const real=this.buffer.length
          if (real===PREPROCESS.windowSize) {
            const snapshot=this.buffer.slice(); window={samples:snapshot,startTime:snapshot[0].time,endTime:snapshot[snapshot.length-1].time,padded:0}; this.sinceWindow=0
          } else if (real>=PREPROCESS.earlyMinSamples && this.startedStill===true && measuredHz>=PREPROCESS.targetHz) {
            // Started standing still: the history before the first sample is assumed still too, so it is filled with
            // copies of the first real sample. This gives estimates from ~0.7 s instead of ~3 s. Never done when the
            // device was already moving (the copied history would be wrong).
            const first=this.buffer[0],snapshot=[...Array.from({length:PREPROCESS.windowSize-real},()=>first),...this.buffer]
            window={samples:snapshot,startTime:first.time,endTime:snapshot[snapshot.length-1].time,padded:PREPROCESS.windowSize-real}; this.sinceWindow=0
          }
        }
      }
      this.nextTime+=stepMs
    }
    this.previous={time:input.time,values:filtered}
    if (this.state !== 'low-rate' || input.time-this.started >= PREPROCESS.rateCheckMs) this.state=this.buffer.length===PREPROCESS.windowSize ? 'ready' : 'warming'
    return {samples,window,state:this.state}
  }
}
