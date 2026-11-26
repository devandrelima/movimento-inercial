export type Point = {x:number;y:number}
export type Segment = {id:number;points:Point[]}
type Prediction = (values:Float32Array)=>Promise<[number,number]>
type Job = {values:Float32Array;epoch:number}

/** One inference at a time; resume from the last known position after gaps. */
export class Tracker {
  private active=false
  private epoch=0
  private busy=false
  private queue:Job[]=[]
  private segments:Segment[]=[]
  private sequence=0
  private readonly predict:Prediction
  private readonly update:(segments:Segment[])=>void
  private readonly error:(message:string)=>void
  constructor(predict:Prediction,update:(segments:Segment[])=>void,error:(message:string)=>void) {this.predict=predict;this.update=update;this.error=error}
  start():void {this.active=true;this.interrupt()}
  pause():void {this.active=false;this.interrupt()}
  interrupt():void {this.epoch++;this.queue=[]}
  clear():void {this.pause();this.segments=[];this.sequence=0;this.update([])}
  enqueue(values:Float32Array):boolean {
    if (!this.active) return false
    if (this.queue.length>=4) {this.interrupt();this.error('IA atrasada; iniciando um novo trecho');return false}
    this.queue.push({values,epoch:this.epoch});void this.pump();return true
  }
  private async pump():Promise<void> {
    if (this.busy) return
    this.busy=true
    try {
      while (this.queue.length) {
        const job=this.queue.shift()!
        try {
          const [dx,dy]=await this.predict(job.values)
          if (!this.active || job.epoch!==this.epoch) continue
          if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('Predição inválida')
          if (!this.segments.length) this.segments=[{id:++this.sequence,points:[{x:0,y:0}]}]
          const last=this.segments[this.segments.length-1],previous=last.points[last.points.length-1]
          const point={x:previous.x+dx,y:previous.y+dy}
          this.segments=[...this.segments.slice(0,-1),{...last,points:[...last.points,point]}]
          this.update(this.segments)
        } catch(error) {
          if (this.active && job.epoch===this.epoch) {this.interrupt();this.error(error instanceof Error ? error.message : 'Falha na inferência')}
        }
      }
    } finally {this.busy=false}
  }
}
