// Roda as janelas de um JSON (windows.json ou walking.json) pelo modelo REAL, no mesmo worker do aplicativo.
// Uso: PLAYWRIGHT_DIR=/caminho/node_modules CHROME=/caminho/chrome node inferir.mjs <entrada.json> <saida.json> <worker.js>
//   <worker.js> é o arquivo dist/assets/inference.worker-*.js; o aplicativo deve estar servido em $URL (padrão http://127.0.0.1:4199/).
import {createRequire} from 'module'
import fs from 'fs'
const [input,output,worker]=process.argv.slice(2)
if(!input||!output||!worker){console.error('uso: node inferir.mjs <entrada.json> <saida.json> <worker.js>');process.exit(1)}
const {chromium}=createRequire(`${process.env.PLAYWRIGHT_DIR??'./node_modules'}/`)('playwright')
const browser=await chromium.launch({executablePath:process.env.CHROME,args:['--no-sandbox']})
const page=await (await browser.newContext()).newPage()
await page.route('**/janelas.json',route=>route.fulfill({path:input,contentType:'application/json'}))
await page.goto(process.env.URL??'http://127.0.0.1:4199/')
const out=await page.evaluate(async name=>{
 const data=await (await fetch('/janelas.json')).json()
 const w=new Worker('/assets/'+name);let id=0
 const call=msg=>new Promise((res,rej)=>{const my=++id;const h=e=>{if(e.data.id!==my||typeof e.data.progress==='number')return;w.removeEventListener('message',h);e.data.ok?res(e.data):rej(new Error(e.data.error))};w.addEventListener('message',h);w.postMessage({...msg,id:my})})
 await call({type:'init'})
 const values=[]
 for(const win of data.windows){const r=await call({type:'predict',values:new Float32Array(win.x)});values.push(r.values)}
 return values
},worker)
fs.writeFileSync(output,JSON.stringify(out))
console.log('saídas',out.length)
await browser.close()
