import {describe,expect,it} from 'vitest'
import {chooseStartStage,clearDeviceCheck,clearInstalledModel,loadDeviceCheck,loadInstalledModel,MODEL_INSTALLED_KEY,DEVICE_CHECK_KEY,saveDeviceCheck,saveInstalledModel} from './startup'

const memory=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)},data}}
const H='a'.repeat(64),OLD='b'.repeat(64)

describe('tela inicial',()=>{
 it('sem teste aprovado, começa pelo teste de dispositivo',()=>{
  expect(chooseStartStage({deviceChecked:false,installedHash:H,currentHash:H,cached:true})).toBe('check')
 })
 it('teste aprovado e modelo atual instalado vai direto para a grade',()=>{
  expect(chooseStartStage({deviceChecked:true,installedHash:H,currentHash:H,cached:true})).toBe('app')
 })
 it('teste aprovado, mas modelo ausente, de outra versão ou apagado do cache vai para o download',()=>{
  expect(chooseStartStage({deviceChecked:true,installedHash:null,currentHash:H,cached:false})).toBe('loading')
  expect(chooseStartStage({deviceChecked:true,installedHash:OLD,currentHash:H,cached:true})).toBe('loading')
  expect(chooseStartStage({deviceChecked:true,installedHash:H,currentHash:H,cached:false})).toBe('loading')
 })
})

describe('registros locais',()=>{
 it('lembra o teste aprovado e permite limpar',()=>{
  const store=memory();expect(loadDeviceCheck(store)).toBe(false)
  saveDeviceCheck(store,1000);expect(loadDeviceCheck(store)).toBe(true);expect(JSON.parse(store.data.get(DEVICE_CHECK_KEY)!)).toMatchObject({version:1,ok:true,at:1000})
  clearDeviceCheck(store);expect(loadDeviceCheck(store)).toBe(false)
 })
 it('lembra o hash do modelo instalado',()=>{
  const store=memory();expect(loadInstalledModel(store)).toBeNull()
  saveInstalledModel(H,store);expect(loadInstalledModel(store)).toBe(H)
  clearInstalledModel(store);expect(loadInstalledModel(store)).toBeNull()
 })
 it('ignora registros corrompidos, de outra versão ou sem armazenamento',()=>{
  const store=memory()
  store.setItem(DEVICE_CHECK_KEY,'{quebrado');expect(loadDeviceCheck(store)).toBe(false)
  store.setItem(DEVICE_CHECK_KEY,JSON.stringify({version:2,ok:true}));expect(loadDeviceCheck(store)).toBe(false)
  store.setItem(DEVICE_CHECK_KEY,JSON.stringify({version:1,ok:false}));expect(loadDeviceCheck(store)).toBe(false)
  store.setItem(MODEL_INSTALLED_KEY,JSON.stringify({hash:42}));expect(loadInstalledModel(store)).toBeNull()
  expect(loadDeviceCheck(null)).toBe(false);expect(loadInstalledModel(null)).toBeNull()
  expect(()=>{saveDeviceCheck(null);saveInstalledModel(H,null);clearDeviceCheck(null);clearInstalledModel(null)}).not.toThrow()
  const full={getItem:()=>null,setItem:()=>{throw new Error('cheio')},removeItem:()=>{throw new Error('negado')}}
  expect(()=>{saveDeviceCheck(full);saveInstalledModel(H,full);clearDeviceCheck(full);clearInstalledModel(full)}).not.toThrow()
 })
})
