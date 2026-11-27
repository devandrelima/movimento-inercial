// Telas novas (mapa sem sensores, lista de mapas públicos e editor) cabem na aba sem rolar a página.
async page => {
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click();await page.getByRole('alert').waitFor({timeout:9000})
 const sizes=[[320,568],[360,640],[390,844],[768,1024],[1280,800],[568,320],[640,360],[844,390]],bad=[]
 const check=async stage=>{for(const [w,h] of sizes){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(60)
  const d=await page.evaluate(()=>{const e=document.documentElement;// botões dentro de listas roláveis (ex.: .maps-list com muitos mapas) podem ficar abaixo da dobra; o que não pode é a página rolar
   const buttons=[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&!b.closest('.maps-list')).map(b=>b.getBoundingClientRect());return {sw:e.scrollWidth,sh:e.scrollHeight,cut:buttons.filter(r=>r.right>innerWidth+1||r.bottom>innerHeight+1||r.left<-1).length}})
  if(d.sw>w||d.sh>h||d.cut)bad.push([stage,w,h,d])}}
 await check('teste falhou')
 await page.getByRole('button',{name:'Abrir os mapas sem sensores'}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor()
 await check('mapa sem sensores')
 await page.getByRole('button',{name:'Criar sala'}).click();await page.getByRole('button',{name:'Adicionar'}).click()
 await check('editor')
 await page.getByRole('button',{name:'Cancelar'}).click();await page.getByRole('button',{name:'Mapas públicos'}).click();await page.getByRole('heading',{name:'Mapas públicos'}).waitFor()
 await page.locator('.maps-empty, li').first().waitFor({timeout:8000})
 await check('lista de mapas')
 if(bad.length)throw Error('Telas novas não cabem na aba: '+JSON.stringify(bad))
 return {tamanhos:sizes.length,telas:4,problemas:0}
}
