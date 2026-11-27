import type {Room} from './room'

/** Cliente da API dos mapas públicos (mesma origem: /api, via Nginx). */
export type MapSummary={id:string;name:string;owner:string;createdAt:string;updatedAt:string;updatedBy?:string;width:number;height:number;obstacles:number;rects:number[][]}
export type PublicMap={id:string;name:string;owner:string;createdAt:string;updatedAt:string;updatedBy?:string;room:Room}
export type Session={token:string;username:string;expiresAt:number}

export class ApiError extends Error {
 status:number;code:string
 constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code}
}

const SESSION_KEY='norte-session-v1'
let memorySession:Session|null=null
const validSession=(value:unknown):value is Session=>{
 const s=value as Session|null
 return !!s&&typeof s.token==='string'&&typeof s.username==='string'&&typeof s.expiresAt==='number'&&s.expiresAt>Date.now()
}
/** A sessão fica só na aba (sessionStorage) e expira junto com o token do servidor. */
export function getSession():Session|null {
 let value:unknown=memorySession
 try {const raw=sessionStorage.getItem(SESSION_KEY);if(raw)value=JSON.parse(raw)} catch {/* usa a cópia em memória */}
 if(validSession(value))return value
 clearSession();return null
}
export function setSession(session:Session){memorySession=session;try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(session))}catch{/* só em memória */}}
export function clearSession(){memorySession=null;try{sessionStorage.removeItem(SESSION_KEY)}catch{/* nada a limpar */}}

async function request<T>(path:string,options:{method?:string;body?:unknown;auth?:boolean}={}):Promise<T> {
 const headers:Record<string,string>={}
 if(options.body!==undefined)headers['Content-Type']='application/json'
 if(options.auth){const session=getSession();if(!session)throw new ApiError(401,'unauthorized','Faça login para continuar.');headers.Authorization=`Bearer ${session.token}`}
 let response:Response
 try {
  response=await fetch(`/api${path}`,{method:options.method??'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body),signal:AbortSignal.timeout(15000)})
 } catch {throw new ApiError(0,'network','Não foi possível falar com o servidor. Verifique a conexão e tente de novo.')}
 let data:{message?:string;error?:string}&Record<string,unknown>={}
 try {data=await response.json()} catch {/* resposta sem JSON */}
 if(!response.ok)throw new ApiError(response.status,String(data.error??'http'),typeof data.message==='string'?data.message:`Erro ${response.status} no servidor.`)
 return data as T
}

export const api={
 listMaps:()=>request<{maps:MapSummary[]}>('/maps').then(r=>r.maps),
 getMap:(id:string)=>request<{map:PublicMap}>(`/maps/${id}`).then(r=>r.map),
 async login(username:string,password:string){
  const session=await request<Session>('/login',{method:'POST',body:{username,password}})
  setSession({token:session.token,username:session.username,expiresAt:session.expiresAt});return session
 },
 createMap:(name:string,room:Room)=>request<{map:PublicMap}>('/maps',{method:'POST',body:{name,room},auth:true}).then(r=>r.map),
 updateMap:(id:string,name:string,room:Room)=>request<{map:PublicMap}>(`/maps/${id}`,{method:'PUT',body:{name,room},auth:true}).then(r=>r.map),
 deleteMap:(id:string)=>request<{ok:true}>(`/maps/${id}`,{method:'DELETE',auth:true}).then(()=>undefined),
}
