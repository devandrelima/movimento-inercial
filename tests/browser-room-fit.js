async page => {
 await page.evaluate(()=>localStorage.removeItem('norte-room-v1'));await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click();await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)});
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed));await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Criar sala'}).click();await page.getByRole('button',{name:'Salvar sala'}).click()
 await page.getByRole('button',{name:'Editar sala'}).click()
 await page.getByRole('button',{name:'Adicionar'}).click()
 const start=page.locator('.room-section').nth(1);await start.getByLabel('X (m)').fill('4');await start.getByLabel('Y (m)').fill('3')
 await page.getByRole('button',{name:'Salvar sala'}).click();await page.getByRole('alert').waitFor()
 const sizes=[[320,568],[360,640],[390,844],[768,1024],[1024,768],[1024,1366],[1280,800],[1920,1080],[2560,1080],[568,320],[640,360],[844,390]]
 const bad=[],rows=[]
 for(const [w,h] of sizes){
  await page.setViewportSize({width:w,height:h});await page.waitForTimeout(80)
  const d=await page.evaluate(()=>{const q=s=>document.querySelector(s).getBoundingClientRect(),de=document.documentElement,page=q('.room-page'),set=document.querySelector('.room-settings'),canvas=q('.room-canvas'),save=q('.room-save'),help=q('.room-canvas-error'),layout=q('.room-layout')
   return {vw:innerWidth,vh:innerHeight,page:[page.left,page.top,page.right,page.bottom].map(Math.round),docScroll:[de.scrollWidth,de.scrollHeight],bodyScroll:[document.body.scrollWidth,document.body.scrollHeight],settingsOverflow:set.scrollHeight-set.clientHeight,canvas:[Math.round(canvas.width),Math.round(canvas.height)],saveBottom:Math.round(save.bottom),helpBottom:Math.round(help.bottom),layoutBottom:Math.round(layout.bottom),layoutRight:Math.round(layout.right)}})
  rows.push(w+'x'+h+' canvas '+d.canvas.join('x')+' settingsOverflow '+d.settingsOverflow+' layout→'+d.layoutRight+','+d.layoutBottom)
  if(d.page[0]!==0||d.page[1]!==0||d.page[2]!==w||d.page[3]!==h)bad.push(['page não ocupa a aba',w,h,d.page])
  if(d.docScroll[0]>w||d.docScroll[1]>h)bad.push(['documento rola',w,h,d.docScroll])
  if(d.settingsOverflow>1)bad.push(['painel de ajustes rola',w,h,d.settingsOverflow])
  if(d.layoutBottom>h+1||d.layoutRight>w+1||d.helpBottom>h||d.canvas[0]<100||d.canvas[1]<60)bad.push(['conteúdo fora/pequeno',w,h,d])
 }
 if(bad.length)throw Error('Editor não ocupa só a aba visível: '+JSON.stringify(bad))
 return {tamanhos:sizes.length,problemas:0}
}
