import {useCallback,useEffect,useState} from 'react'
import {api,ApiError,type MapSummary,type PublicMap} from './api'
import {useAuth} from './auth-ui'
import {validRoom} from './room'
import type {RoomLink} from './room-link'
import './RoomEditor.css'
import './PublicMaps.css'

type Props={link:RoomLink|null;onUse:(map:PublicMap,edit:boolean)=>void;onUnlink:(id:string)=>void;onClose:()=>void}
const when=(iso:string)=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}

/** Miniatura da planta (a sala completa só é baixada ao carregar o mapa). */
export function Thumb({rects,width,height}:{rects:number[][];width:number;height:number}) {
 return <svg className="map-thumb" viewBox={`0 ${-height} ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <rect x="0" y={-height} width={width} height={height} fill="#f3f8f7" stroke="#608f89" strokeWidth={Math.max(width,height)/40}/>
  {rects.map(([x,y,w,h],i)=><rect key={i} x={x} y={-y-h} width={w} height={h} fill="#a9c9c5" stroke="#638c87" strokeWidth={Math.max(width,height)/80}/>)}
 </svg>
}

export default function PublicMaps({link,onUse,onUnlink,onClose}:Props) {
 const [maps,setMaps]=useState<MapSummary[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null),[notice,setNotice]=useState('')
 const auth=useAuth()
 const load=useCallback(()=>{
  setError('');setMaps(null)
  api.listMaps().then(setMaps).catch(e=>setError(e instanceof ApiError?e.message:'Não foi possível carregar a lista.'))
 },[])
 useEffect(()=>{
  let live=true
  api.listMaps().then(list=>{if(live)setMaps(list)}).catch(e=>{if(live)setError(e instanceof ApiError?e.message:'Não foi possível carregar a lista.')})
  return()=>{live=false}
 },[])
 async function open(map:MapSummary,edit:boolean){
  if(busy)return
  setBusy(map.id);setNotice('')
  try {
   const full=await api.getMap(map.id)
   if(!validRoom(full.room)){setNotice('Este mapa está em um formato que este aplicativo não entende.');return}
   onUse(full,edit)
  } catch(e) {setNotice(e instanceof ApiError?e.message:'Não foi possível abrir o mapa.')}
  finally {setBusy(null)}
 }
 async function remove(map:MapSummary){
  if(busy)return
  setNotice('')
  try {
   const done=await auth.run('Para excluir um mapa público é preciso entrar com usuário e senha.',async()=>{
    if(!window.confirm(`Excluir o mapa público “${map.name}” para todos? Esta ação não pode ser desfeita.`))return false
    setBusy(map.id);await api.deleteMap(map.id);return true
   })
   if(done){setMaps(list=>list&&list.filter(item=>item.id!==map.id));onUnlink(map.id);setNotice(`Mapa “${map.name}” excluído.`)}
  } catch(e) {setNotice(e instanceof ApiError?e.message:'Não foi possível excluir o mapa.')}
  finally {setBusy(null)}
 }
 return <div className="room-page" role="main"><div className="room-editor">
  <header className="room-header"><div><span className="room-kicker">COMPARTILHADOS</span><h1>Mapas públicos</h1></div><div className="room-header-actions"><button className="room-ghost" onClick={onClose}>Voltar</button></div></header>
  <section className="maps-panel" aria-label="Lista de mapas públicos">
   <div className="maps-toolbar"><p>Qualquer pessoa pode carregar estes mapas. Publicar, editar ou excluir exige login.</p>{auth.session&&<span className="maps-user">Conectado como <strong>{auth.session.username}</strong> <button className="room-link" onClick={auth.logout}>Sair</button></span>}</div>
   {notice&&<p className="maps-notice" role="status">{notice}</p>}
   <div className="maps-list">
    {error&&<div className="maps-empty" role="alert"><p>{error}</p><button className="room-link" onClick={load}>Tentar de novo</button></div>}
    {!error&&maps===null&&<p className="maps-empty" role="status">Carregando mapas…</p>}
    {maps&&maps.length===0&&<p className="maps-empty">Ainda não há mapas públicos. Crie uma sala e use “Publicar” no editor.</p>}
    {maps&&maps.length>0&&<ul>{maps.map(map=><li key={map.id} className={link?.id===map.id?'is-current':undefined}>
     <Thumb width={map.width} height={map.height} rects={map.rects??[]}/>
     <div className="map-info"><strong>{map.name}</strong><span>{map.width.toLocaleString('pt-BR')} × {map.height.toLocaleString('pt-BR')} m · {map.obstacles} {map.obstacles===1?'obstáculo':'obstáculos'}</span><span>Atualizado em {when(map.updatedAt)} por {map.updatedBy??map.owner}{link?.id===map.id?' · em uso':''}</span></div>
     <div className="map-actions"><button className="map-use" disabled={busy!==null} onClick={()=>open(map,false)}>{busy===map.id?'Abrindo…':'Carregar'}</button><button className="room-link" disabled={busy!==null} onClick={()=>open(map,true)}>Editar</button><button className="room-link room-danger" disabled={busy!==null} onClick={()=>remove(map)}>Excluir</button></div>
    </li>)}</ul>}
   </div>
  </section>
  {auth.dialog}
 </div></div>
}
