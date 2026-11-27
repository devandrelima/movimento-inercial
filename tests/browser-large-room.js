// Salas de até 500 × 500 m: editor aceita, grade adapta, mapa abre ajustado e a rota não trava.
// Usa worker de modelo falso e sensores sintéticos; não envolve sensores nem modelo reais.
async page => {
 await page.addInitScript(()=>{
  class FakeWorker {
   onmessage=null;onerror=null;onmessageerror=null;
   postMessage(message){queueMicrotask(()=>this.onmessage?.({data:message.type==='init'?{id:message.id,ok:true}:{id:message.id,ok:true,values:[0,.8]}}))}
   terminate(){}
  }
  window.Worker=FakeWorker
 })
 await page.evaluate(()=>{localStorage.clear()});await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click()
 await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed))
 await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:10000})
 const results={}

 // 1) O editor aceita 500 × 500 m e recusa 501.
 await page.getByRole('button',{name:'Criar sala'}).click()
 const dims=page.locator('.room-section').nth(0)
 await dims.getByLabel('Largura').fill('501');await dims.getByLabel('Altura').fill('500')
 await page.getByRole('button',{name:'Salvar sala'}).click();await page.getByRole('alert').waitFor({timeout:3000})
 if(await page.evaluate(()=>localStorage.getItem('norte-room-v1')))throw Error('501 m não deveria ser salvo')
 await dims.getByLabel('Largura').fill('500')
 await page.getByRole('button',{name:'Adicionar'}).click()
 await page.waitForTimeout(300)
 const grid=await page.locator('#room-grid').getAttribute('width');if(!(Number(grid)>=5))throw Error('Grade do editor deveria engrossar numa sala de 500 m, passo '+grid)
 const roomBox=await page.locator('.room-canvas').boundingBox();if(roomBox.width<50||roomBox.height<50)throw Error('Planta não apareceu')
 await page.getByRole('button',{name:'Salvar sala'}).click();await page.getByRole('button',{name:'Editar sala'}).waitFor()
 const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('norte-room-v1')));if(saved.width!==500||saved.height!==500)throw Error('Sala de 500 m não foi salva')
 results.editor='500 × 500 m aceito, 501 recusado, grade '+grid+' m'

 // 2) O mapa abre com a sala inteira visível e grade legível.
 const field=await page.locator('.field').boundingBox()
 const rect=await page.locator('.trajectory-layer g[aria-label="Sala e obstáculos"] rect').first().boundingBox()
 if(rect.x<field.x-2||rect.y<field.y-2||rect.x+rect.width>field.x+field.width+2||rect.y+rect.height>field.y+field.height+2)throw Error('Sala não coube na área do mapa: '+JSON.stringify({rect,field}))
 const label=await page.locator('.field-top').innerText();if(/Grade: 1 m/.test(label))throw Error('Grade deveria ter engrossado: '+label)
 results.mapa='sala inteira visível; '+label.split('\n').pop()

 // 3) Rota até o canto oposto aparece sem travar a página.
 const at=(x,y)=>({x:rect.x+x/500*rect.width,y:rect.y+(500-y)/500*rect.height})
 const p=at(480,470),t0=Date.now();await page.mouse.click(p.x,p.y)
 await page.getByLabel('Rota sugerida').waitFor({timeout:8000});await page.getByLabel('Destino',{exact:true}).waitFor()
 const elapsed=Date.now()-t0;if(elapsed>6000)throw Error('Rota demorou '+elapsed+' ms')
 const marker=await page.getByLabel('Destino',{exact:true}).boundingBox();if(Math.hypot(marker.x+marker.width/2-p.x,marker.y+marker.height/2-p.y)>3)throw Error('Destino fora do ponto clicado')
 results.rota='traçada em '+elapsed+' ms'

 // 4) Zoom acompanha: aproximar volta a uma grade de 1 m e a página continua responsiva.
 for(let i=0;i<30;i++)await page.getByRole('button',{name:'Aumentar zoom'}).click({timeout:2000}).catch(()=>{})
 const after=await page.locator('.field-top').innerText();if(!/Grade: 1 m/.test(after))throw Error('Aproximar deveria voltar a grade de 1 m: '+after)
 results.zoom='grade volta a 1 m ao aproximar'
 return results
}
