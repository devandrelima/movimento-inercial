/** Vínculo entre a sala local e o mapa público de onde ela veio (ou onde foi publicada). */
export type RoomLink={id:string;name:string}
const KEY='norte-room-link-v1'
export function loadLink():RoomLink|null {
 try {
  const value:unknown=JSON.parse(localStorage.getItem(KEY)??'null')
  const link=value as RoomLink|null
  return link&&typeof link.id==='string'&&typeof link.name==='string'?link:null
 } catch {return null}
}
export function saveLink(link:RoomLink|null){
 try {if(link)localStorage.setItem(KEY,JSON.stringify(link));else localStorage.removeItem(KEY)} catch {/* sem armazenamento: vale só nesta página */}
}
