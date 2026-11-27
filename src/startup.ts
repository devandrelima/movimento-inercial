import {MODEL_CACHE,MODEL_HASH,MODEL_URL} from './model-info'

/**
 * Memória da instalação neste navegador. Duas informações, ambas só em localStorage/Cache Storage deste aparelho:
 * - o resultado do teste de dispositivo, aprovado ou reprovado (não precisa repetir a cada visita);
 * - qual modelo está instalado (hash verificado), guardado no Cache Storage.
 */
export const DEVICE_CHECK_KEY='norte-device-check-v1'
export const MODEL_INSTALLED_KEY='norte-model-installed-v1'
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>
const browserStore=():Store|null=>{try{return globalThis.localStorage??null}catch{return null}}
const read=(store:Store|null,key:string):unknown=>{try{return JSON.parse(store?.getItem(key)??'null')}catch{return null}}
const write=(store:Store|null,key:string,value:unknown)=>{try{store?.setItem(key,JSON.stringify(value))}catch{/* sem armazenamento: o teste volta a aparecer */}}

export type DeviceCheck='passed'|'failed'
export function loadDeviceCheck(store:Store|null=browserStore()):DeviceCheck|null {
 const value=read(store,DEVICE_CHECK_KEY) as {version?:number;ok?:unknown}|null
 if(value?.version!==1)return null
 return value.ok===true?'passed':value.ok===false?'failed':null
}
export function saveDeviceCheck(passed:boolean,store:Store|null=browserStore(),now=Date.now()){write(store,DEVICE_CHECK_KEY,{version:1,ok:passed,at:now})}
export function clearDeviceCheck(store:Store|null=browserStore()){try{store?.removeItem(DEVICE_CHECK_KEY)}catch{/* nada a limpar */}}

export function loadInstalledModel(store:Store|null=browserStore()):string|null {
 const value=read(store,MODEL_INSTALLED_KEY) as {hash?:unknown}|null
 return typeof value?.hash==='string'?value.hash:null
}
export function saveInstalledModel(hash:string,store:Store|null=browserStore(),now=Date.now()){write(store,MODEL_INSTALLED_KEY,{hash,at:now})}
export function clearInstalledModel(store:Store|null=browserStore()){try{store?.removeItem(MODEL_INSTALLED_KEY)}catch{/* nada a limpar */}}

/** O arquivo do modelo ainda está no Cache Storage? (o navegador pode apagá-lo sozinho se faltar espaço) */
export async function modelCached():Promise<boolean> {
 try {return !!globalThis.caches&&!!(await (await caches.open(MODEL_CACHE)).match(MODEL_URL))} catch {return false}
}

export type StartStage='check'|'loading'|'app'|'limited'
/**
 * Tela inicial:
 * - teste de dispositivo ainda não feito → teste;
 * - reprovado antes → direto para o mapa sem sensores (o teste não é repetido a cada visita);
 * - aprovado, mas o modelo instalado não é o usado (ausente ou outra versão) → baixar o modelo;
 * - aprovado e o modelo instalado é o atual → direto para a grade.
 */
export function chooseStartStage(input:{deviceCheck:DeviceCheck|null;installedHash:string|null;currentHash:string;cached:boolean}):StartStage {
 if(input.deviceCheck===null)return 'check'
 if(input.deviceCheck==='failed')return 'limited'
 return input.installedHash===input.currentHash&&input.cached?'app':'loading'
}
export async function startStage():Promise<StartStage> {
 const deviceCheck=loadDeviceCheck(),installedHash=loadInstalledModel()
 const cached=deviceCheck==='passed'&&installedHash===MODEL_HASH?await modelCached():false
 return chooseStartStage({deviceCheck,installedHash,currentHash:MODEL_HASH,cached})
}
