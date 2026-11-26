type Reply = {id:number;ok:boolean;error?:string;values?:number[];progress?:number}
type Pending = {resolve:(value:Reply)=>void;reject:(error:Error)=>void;timer:number;onProgress?:(value:number)=>void}
export class ModelClient {
  private worker:Worker
  private pending=new Map<number,Pending>()
  private sequence=0
  constructor() {
    this.worker=new Worker(new URL('./inference.worker.ts',import.meta.url))
    this.worker.onmessage=(event:MessageEvent<Reply>)=>{
      const reply=event.data, task=this.pending.get(reply.id)
      if (!task) return
      if (typeof reply.progress==='number') {task.onProgress?.(reply.progress);return}
      window.clearTimeout(task.timer);this.pending.delete(reply.id)
      if (reply.ok) task.resolve(reply);else task.reject(new Error(reply.error || 'Erro na IA'))
    }
    this.worker.onerror=()=>this.fail(new Error('Falha ao iniciar o processamento da IA'))
    this.worker.onmessageerror=()=>this.fail(new Error('Falha na comunicação com a IA'))
  }
  private fail(error:Error) {
    this.worker.terminate()
    for (const task of this.pending.values()) {window.clearTimeout(task.timer);task.reject(error)}
    this.pending.clear()
  }
  private request(type:'init'|'predict',values?:Float32Array,onProgress?:(value:number)=>void):Promise<Reply> {
    const id=++this.sequence
    return new Promise((resolve,reject)=>{
      const timer=window.setTimeout(()=>this.fail(new Error(type==='init' ? 'Tempo esgotado ao carregar a IA' : 'Tempo esgotado na inferência')),type==='init'?60000:10000)
      this.pending.set(id,{resolve,reject,timer,onProgress})
      try {this.worker.postMessage({id,type,values})} catch(error) {this.fail(error instanceof Error?error:new Error('Erro na IA'))}
    })
  }
  async initialize(onProgress?:(value:number)=>void):Promise<void> {await this.request('init',undefined,onProgress)}
  async predict(values:Float32Array):Promise<[number,number]> {
    const result=await this.request('predict',values)
    if (!result.values || result.values.length!==2 || !result.values.every(Number.isFinite)) throw new Error('Saída inválida da IA')
    return [result.values[0],result.values[1]]
  }
  dispose():void {this.fail(new Error('IA encerrada'))}
}
