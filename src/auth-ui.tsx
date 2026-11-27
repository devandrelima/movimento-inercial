import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import {api,ApiError,clearSession,getSession,type Session} from './api'
import './Dialogs.css'

/** Janela de login (usuário e senha), usada ao publicar, editar ou excluir mapas públicos. */
function LoginDialog({reason,onDone}:{reason:string;onDone:(ok:boolean)=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),user=useRef<HTMLInputElement>(null)
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{const el=dialog.current;if(el&&!el.open){el.showModal();user.current?.focus()}},[])
 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return
  setBusy(true);setError('')
  try {await api.login(username,password);onDone(true)}
  catch(e) {setError(e instanceof ApiError?e.message:'Não foi possível entrar.');setPassword('');setBusy(false)}
 }
 return <dialog ref={dialog} className="auth-dialog" aria-labelledby="auth-title" onCancel={event=>{event.preventDefault();onDone(false)}}>
  <form onSubmit={submit}>
   <h2 id="auth-title">Entrar</h2>
   <p>{reason}</p>
   <label className="auth-field"><span>Usuário</span><input ref={user} value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required/></label>
   <label className="auth-field"><span>Senha</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
   {error&&<p className="auth-error" role="alert">{error}</p>}
   <div className="dialog-actions"><button type="button" className="secondary" onClick={()=>onDone(false)}>Cancelar</button><button type="submit" className="auth-submit" disabled={busy}>{busy?'Entrando…':'Entrar'}</button></div>
  </form>
 </dialog>
}

/**
 * Controla o login por demanda: `run` pede usuário e senha se não houver sessão válida,
 * executa a chamada e, se o servidor responder 401 (sessão vencida), pede o login de novo uma vez.
 */
export function useAuth() {
 const [session,setSession]=useState<Session|null>(getSession)
 const [request,setRequest]=useState<{reason:string;resolve:(ok:boolean)=>void}|null>(null)
 const ensure=useCallback((reason:string)=>getSession()?Promise.resolve(true):new Promise<boolean>(resolve=>setRequest({reason,resolve})),[])
 const run=useCallback(async<T,>(reason:string,call:()=>Promise<T>):Promise<T|null>=>{
  for(let attempt=0;attempt<2;attempt++){
   if(!(await ensure(reason)))return null
   try {return await call()}
   catch(e) {if(e instanceof ApiError&&e.status===401){clearSession();setSession(null);continue}throw e}
  }
  throw new ApiError(401,'unauthorized','Não foi possível autenticar.')
 },[ensure])
 const logout=useCallback(()=>{clearSession();setSession(null)},[])
 const dialog=request?<LoginDialog reason={request.reason} onDone={ok=>{setSession(getSession());request.resolve(ok);setRequest(null)}}/>:null
 return {session,run,logout,dialog}
}
