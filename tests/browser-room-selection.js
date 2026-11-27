// Seleção no editor de sala: obstáculos pequenos, finos e encostados na borda/canto devem ser fáceis de pegar.
async page => {
 await page.addInitScript(()=>{})
 await page.evaluate(()=>{localStorage.clear()});await page.reload()
 await page.getByRole('button',{name:'Testar sensores'}).click()
 await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed))
 await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000})
 await page.getByRole('button',{name:'Criar sala'}).click()

 const dims=page.locator('.room-section').nth(0),obst=page.locator('.room-section').nth(2)
 await dims.getByLabel('Largura').fill('10');await dims.getByLabel('Altura').fill('8')
 const screen=(x,y)=>page.locator('.room-canvas').evaluate((el,[x,y])=>{const p=el.createSVGPoint();p.x=x;p.y=-y;const q=p.matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y}},[x,y])
 const field=async l=>(await obst.getByLabel(l,{exact:true}).count())?Number(await obst.getByLabel(l,{exact:true}).inputValue()):null
 const selectedX=async()=>(await obst.getByLabel('X',{exact:true}).count())?field('X'):null
 const click=async(x,y)=>{const p=await screen(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(40)}
 async function add(x,y,w,h){
  await page.getByRole('button',{name:'Adicionar'}).click()
  await obst.getByLabel('X',{exact:true}).fill(String(x));await obst.getByLabel('Y',{exact:true}).fill(String(y));await obst.getByLabel('Largura').fill(String(w));await obst.getByLabel('Altura').fill(String(h))
 }
 const shapes=[['encostado na parede esquerda',0,3,.4,.4],['no canto inferior esquerdo',0,0,.5,.5],['fino na parede direita',9.6,2,.4,3],['rente ao topo',4,7.7,1,.3],['vizinho A',6,4,.5,.5],['vizinho B (gap de 10 cm)',6.6,4,.5,.5]]
 await page.getByRole('button',{name:'Marcar no mapa'}).click();const s=await screen(2,6);await page.mouse.click(s.x,s.y) // início longe dos testes
 for(const [,x,y,w,h] of shapes)await add(x,y,w,h)
 await click(5,1) // espaço vazio: desmarca
 if(await selectedX()!==null)throw Error('Clique no vazio deveria desmarcar')

 const failures=[]
 for(const [name,x,y,w,h] of shapes){
  await click(5,1);await click(x+w/2,y+h/2)
  const got=await selectedX();if(got===null||Math.abs(got-x)>.01)failures.push(name+' (clique no centro) -> '+got)
 }
 // tolerância: clicar ~5 px fora de um obstáculo pequeno ainda o seleciona (dentro da sala)
 const ppu=(await page.locator('.room-canvas').evaluate(el=>el.getScreenCTM().a))
 await click(5,1);await click(6+.25,4+.25+.25+5/ppu) // acima de "vizinho A", a ~5 px da aresta
 {const got=await selectedX();if(got===null||Math.abs(got-6)>.01)failures.push('tolerância fora do obstáculo -> '+got)}
 // o obstáculo selecionado encostado na parede é movido pelo corpo (não redimensiona a sala)
 await click(5,1);await click(.2,3.2)
 const before=await dims.getByLabel('Largura').inputValue()
 const a=await screen(.2,3.2),b=await screen(1.2,3.2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});await page.mouse.up();await page.waitForTimeout(100)
 if(await dims.getByLabel('Largura').inputValue()!==before)failures.push('arrastar obstáculo na parede mudou a largura da sala')
 {const x=await field('X');if(x===null||Math.abs(x-1)>.15)failures.push('obstáculo na parede não foi movido: x='+x)}
 // a borda da sala continua agarrável fora do desenho
 await click(5,1);const r=await screen(10,4),r2=await screen(11,4);await page.mouse.move(r.x+6,r.y);await page.mouse.down();await page.mouse.move(r2.x+6,r2.y,{steps:6});await page.mouse.up();await page.waitForTimeout(300)
 if(Number(await dims.getByLabel('Largura').inputValue())<=10)failures.push('borda da sala não pôde ser arrastada')
 if(failures.length)throw Error('Seleção ruim: '+failures.join(' | '))
 return {obstaculosTestados:shapes.length,problemas:0}
}
