import {describe,expect,it} from 'vitest'
import {chooseStartStage,clearDeviceCheck,clearInstalledModel,loadDeviceCheck,loadInstalledModel,MODEL_INSTALLED_KEY,DEVICE_CHECK_KEY,saveDeviceCheck,saveInstalledModel} from './startup'

const memory=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)},data}}
const H='a'.repeat(64),OLD='b'.repeat(64)

describe('tela inicial',()=>{
 it('sem teste aprovado, começa pelo teste de dispositivo',()=>{
  expect(chooseStartStage({deviceCheck:null,installedHash:H,currentHash:H,cached:true})).toBe('check')
 })
 it('teste reprovado antes vai direto para o mapa sem sensores, sem repetir o teste',()=>{
  expect(chooseStartStage({deviceCheck:'failed',installedHash:null,currentHash:H,cached:false})).toBe('limited')
  expect(chooseStartStage({deviceCheck:'failed',installedHash:H,currentHash:H,cached:true})).toBe('limited')
 })
 it('teste aprovado e modelo atual instalado vai direto para a grade',()=>{
  expect(chooseStartStage({deviceCheck:'passed',installedHash:H,currentHash:H,cached:true})).toBe('app')
 })
 it('teste aprovado, mas modelo ausente, de outra versão ou apagado do cache vai para o download',()=>{
  expect(chooseStartStage({deviceCheck:'passed',installedHash:null,currentHash:H,cached:false})).toBe('loading')
  expect(chooseStartStage({deviceCheck:'passed',installedHash:OLD,currentHash:H,cached:true})).toBe('loading')
  expect(chooseStartStage({deviceCheck:'passed',installedHash:H,currentHash:H,cached:false})).toBe('loading')
 })
})

describe('registros locais',()=>{
 it('lembra o resultado do teste (aprovado ou reprovado) e permite limpar',()=>{
  const store=memory();expect(loadDeviceCheck(store)).toBeNull()
  saveDeviceCheck(true,store,1000);expect(loadDeviceCheck(store)).toBe('passed');expect(JSON.parse(store.data.get(DEVICE_CHECK_KEY)!)).toMatchObject({version:1,ok:true,at:1000})
  saveDeviceCheck(false,store,2000);expect(loadDeviceCheck(store)).toBe('failed')
  saveDeviceCheck(true,store);expect(loadDeviceCheck(store)).toBe('passed')
  clearDeviceCheck(store);expect(loadDeviceCheck(store)).toBeNull()
 })
 it('lembra o hash do modelo instalado',()=>{
  const store=memory();expect(loadInstalledModel(store)).toBeNull()
  saveInstalledModel(H,store);expect(loadInstalledModel(store)).toBe(H)
  clearInstalledModel(store);expect(loadInstalledModel(store)).toBeNull()
 })
 it('ignora registros corrompidos, de outra versão ou sem armazenamento',()=>{
  const store=memory()
  store.setItem(DEVICE_CHECK_KEY,'{quebrado');expect(loadDeviceCheck(store)).toBeNull()
  store.setItem(DEVICE_CHECK_KEY,JSON.stringify({version:2,ok:true}));expect(loadDeviceCheck(store)).toBeNull()
  store.setItem(DEVICE_CHECK_KEY,JSON.stringify({version:1,ok:'talvez'}));expect(loadDeviceCheck(store)).toBeNull()
  store.setItem(MODEL_INSTALLED_KEY,JSON.stringify({hash:42}));expect(loadInstalledModel(store)).toBeNull()
  expect(loadDeviceCheck(null)).toBeNull();expect(loadInstalledModel(null)).toBeNull()
  expect(()=>{saveDeviceCheck(true,null);saveInstalledModel(H,null);clearDeviceCheck(null);clearInstalledModel(null)}).not.toThrow()
  const full={getItem:()=>null,setItem:()=>{throw new Error('cheio')},removeItem:()=>{throw new Error('negado')}}
  expect(()=>{saveDeviceCheck(false,full);saveInstalledModel(H,full);clearDeviceCheck(full);clearInstalledModel(full)}).not.toThrow()
 })
})
