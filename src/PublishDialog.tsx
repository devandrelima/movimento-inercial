import {useEffect,useRef,useState,type FormEvent} from 'react'
import {api,ApiError,type PublicMap} from './api'
import {validRoom,type Room} from './room'
import type {RoomLink} from './room-link'
import type {useAuth} from './auth-ui'
import './Dialogs.css'

type Props={room:Room;link:RoomLink|null;auth:ReturnType<typeof useAuth>;onPublished:(map:PublicMap)=>void;onDeleted:()=>void;onClose:()=>void}

/** Publica a sala do editor como mapa público (novo ou atualizando o vinculado) ou exclui o mapa vinculado. */
export default function PublishDialog({room,link,auth,onPublished,onDeleted,onClose}:Props) {
 const dialog=useRef<HTMLDialogElement>(null)
 const [name,setName]=useState(link?.name??''),[mode,setMode]=useState<'update'|'new'>(link?'update':'new'),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const ok=validRoom(room)
 useEffect(()=>{const el=dialog.current;if(el&&!el.open)el.showModal()},[])
 async function submit(event:FormEvent){
  event.preventDefault();if(busy||!ok)return
  setBusy(true);setError('')
  try {
   const map=await auth.run('Para publicar é preciso entrar com usuário e senha.',()=>link&&mode==='update'?api.updateMap(link.id,name,room):api.createMap(name,room))
   if(map)onPublished(map);else setBusy(false)
  } catch(e) {setError(e instanceof ApiError?e.message:'Não foi possível publicar.');setBusy(false)}
 }
 async function destroy(){
  if(busy||!link)return
  setBusy(true);setError('')
  try {
   const done=await auth.run('Para excluir um mapa público é preciso entrar com usuário e senha.',async()=>{
    if(!window.confirm(`Excluir o mapa público “${link.name}” para todos? Esta ação não pode ser desfeita.`))return false
    await api.deleteMap(link.id);return true
   })
   if(done)onDeleted();else setBusy(false)
  } catch(e) {setError(e instanceof ApiError?e.message:'Não foi possível excluir.');setBusy(false)}
 }
 return <dialog ref={dialog} className="publish-dialog" aria-labelledby="publish-title" onCancel={event=>{event.preventDefault();if(!busy)onClose()}}>
  <form onSubmit={submit}>
   <h2 id="publish-title">Publicar mapa</h2>
   <p>O mapa fica disponível para qualquer pessoa carregar. A sala também é salva neste aparelho.</p>
   {link&&<fieldset className="publish-choices"><legend className="sr-only">Destino</legend>
    <label><input type="radio" name="mode" checked={mode==='update'} onChange={()=>setMode('update')}/><span>Atualizar o mapa público “{link.name}”</span></label>
    <label><input type="radio" name="mode" checked={mode==='new'} onChange={()=>setMode('new')}/><span>Publicar como um novo mapa</span></label>
   </fieldset>}
   <label className="auth-field"><span>Nome do mapa</span><input value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="Ex.: Laboratório 2" required/></label>
   {!ok&&<p className="auth-error" role="alert">Confira as medidas: sala de 1 a 30 m, obstáculos dentro dela e ponto inicial livre.</p>}
   {error&&<p className="auth-error" role="alert">{error}</p>}
   <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="auth-submit" disabled={busy||!ok||!name.trim()}>{busy?'Aguarde…':link&&mode==='update'?'Atualizar':'Publicar'}</button></div>
   {link&&<button type="button" className="publish-danger" onClick={destroy} disabled={busy}>Excluir o mapa público “{link.name}”</button>}
  </form>
 </dialog>
}
