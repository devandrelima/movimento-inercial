async page => {
 await page.evaluate(()=>localStorage.removeItem('norte-room-v1'));await page.reload();
 async function enter(){
  await page.getByRole('button',{name:'Testar sensores'}).click();await page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)});
  await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed));await page.getByRole('button',{name:'Iniciar',exact:true}).click();await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:60000});
 }
 await enter();await page.getByRole('button',{name:'Criar sala'}).click();
 await page.getByLabel('Largura',{exact:true}).fill('10');await page.getByLabel('Altura',{exact:true}).fill('8');
 await page.getByRole('button',{name:'Adicionar'}).click();
 const screen=(x,y)=>page.locator('.room-canvas').evaluate((el,[x,y])=>{const p=el.createSVGPoint();p.x=x;p.y=-y;const q=p.matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y}},[x,y]);
 async function drag(from,to,steps=8){const a=await screen(...from),b=await screen(...to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps});await page.mouse.up();await page.waitForTimeout(260)}
 await drag([5,4],[6,5],5);
 const draggedX=Number(await page.locator('.room-section').nth(2).getByLabel('X',{exact:true}).inputValue());if(Math.abs(draggedX-5.5)>.1)throw Error('Obstáculo não acompanhou o arraste: '+draggedX);
 const controls=page.locator('.room-section').nth(2);await controls.getByLabel('X',{exact:true}).fill('4');await controls.getByLabel('Y',{exact:true}).fill('3');await controls.getByLabel('Largura').fill('2');await controls.getByLabel('Altura').fill('2');
 // Redimensionar por cantos e arestas, remodelar a sala e arrastar o ponto inicial (com mouse; toque exige aparelho real).
 const field=(scope,label)=>scope.getByLabel(label,{exact:true}).inputValue().then(Number);
 const dims=page.locator('.room-section').nth(0),startBox=page.locator('.room-section').nth(1);
 const near=(value,expected,what)=>{if(Math.abs(value-expected)>.06)throw Error(what+': esperado '+expected+', obtido '+value)};
 await drag([1,1],[2.5,1.5]);near(await field(startBox,'X (m)'),2.5,'início arrastado (X)');near(await field(startBox,'Y (m)'),1.5,'início arrastado (Y)');
 await drag([2.5,1.5],[5,4]);{const x=await field(startBox,'X (m)'),y=await field(startBox,'Y (m)');if(x>=4&&x<=6&&y>=3&&y<=5)throw Error('Início entrou no obstáculo: '+x+','+y)}
 await startBox.getByLabel('X (m)').fill('1');await startBox.getByLabel('Y (m)').fill('1');
 await drag([6,4],[7,4]);near(await field(controls,'Largura'),3,'aresta direita (largura)');near(await field(controls,'Altura'),2,'aresta direita preserva altura');near(await field(controls,'X'),4,'aresta direita preserva X');
 await drag([7,5],[8,6]);near(await field(controls,'Largura'),4,'canto superior direito (largura)');near(await field(controls,'Altura'),3,'canto superior direito (altura)');
 await drag([4,4.5],[3,4.5]);near(await field(controls,'X'),3,'aresta esquerda (X)');near(await field(controls,'Largura'),5,'aresta esquerda (largura)');
 await controls.getByLabel('X',{exact:true}).fill('4');await controls.getByLabel('Y',{exact:true}).fill('3');await controls.getByLabel('Largura').fill('2');await controls.getByLabel('Altura').fill('2');
 await drag([8.5,7],[8.6,7.1],2);if(await controls.getByLabel('Largura').count()!==0)throw Error('Clique no vazio não desmarcou o obstáculo');
 await drag([10,4],[12,4]);const grown=await field(dims,'Largura');if(grown<11.95||grown>20)throw Error('aresta direita da sala: '+grown);
 await drag([grown,4],[2,4]);near(await field(dims,'Largura'),6,'sala não encolhe além do obstáculo');
 await drag([0,0],[-2,-1]);const gw=await field(dims,'Largura'),gh=await field(dims,'Altura');if(gw<7.95||gw>16||gh<8.95||gh>20)throw Error('canto inferior esquerdo: '+gw+' x '+gh);near(await field(startBox,'X (m)'),gw-5,'início acompanha a origem da sala (X)');near(await field(startBox,'Y (m)'),gh-7,'início acompanha a origem da sala (Y)')
 const o=await screen(gw-1,gh-4);await page.mouse.click(o.x,o.y);near(await field(controls,'X'),gw-2,'obstáculo deslocado com a sala');
 await controls.getByLabel('X',{exact:true}).fill('4');await controls.getByLabel('Y',{exact:true}).fill('3');
 await startBox.getByLabel('X (m)').fill('1');await startBox.getByLabel('Y (m)').fill('1');
 await dims.getByLabel('Largura').fill('10');await dims.getByLabel('Altura').fill('8');
 await page.getByRole('button',{name:'Marcar no mapa'}).click();
 const start=await screen(1,2);
 await page.mouse.click(start.x,start.y);if(Math.abs(Number(await page.getByLabel('Y (m)').inputValue())-2)>.05)throw Error('Ponto inicial não foi marcado');
 await page.getByLabel('X (m)').fill('5');await page.getByLabel('Y (m)').fill('4');await page.getByRole('button',{name:'Salvar sala'}).click();
 await page.getByRole('alert').waitFor();
 await page.getByLabel('X (m)').fill('1');await page.getByLabel('Y (m)').fill('1');
 await page.getByLabel('Frente').selectOption('up');
 for(const size of [{width:320,height:568},{width:390,height:844},{width:568,height:320},{width:844,height:390}]){
  await page.setViewportSize(size);const bounds=await page.evaluate(()=>{const d=document.documentElement;const controls=['.room-save','.room-canvas','.room-settings'];return {w:innerWidth,h:innerHeight,sw:d.scrollWidth,sh:d.scrollHeight,settingsScroll:document.querySelector('.room-settings').scrollHeight,settingsHeight:document.querySelector('.room-settings').clientHeight,items:controls.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,r.top,r.bottom]})}});
  if(bounds.sw>size.width+1||bounds.sh>size.height+1||bounds.settingsScroll>bounds.settingsHeight+1||bounds.items.some(x=>x[1]<0||x[2]>size.height+1))throw Error('Editor fora da tela: '+JSON.stringify(bounds));
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Salvar sala'}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('norte-room-v1')));if(saved.width!==10||saved.obstacles.length!==1||saved.obstacles[0].x!==4)throw Error('Sala não salva');
 if(await page.locator('.trajectory-layer g[aria-label="Sala e obstáculos"] rect').count()!==2)throw Error('Planta não apareceu');
 await page.reload();await enter();if(await page.locator('.trajectory-layer g[aria-label="Sala e obstáculos"] rect').count()!==2)throw Error('Sala não persistiu após atualizar');
 await page.getByRole('button',{name:'Iniciar coleta'}).click();
 await page.evaluate(()=>{let clock=1000,i=0;Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});window.testFire=async count=>{for(let n=0;n<count;n++,i++){clock+=1000/60;const t=i/60;if(i%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}));window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:4+4*Math.sin(t*8),y:3+4*Math.cos(t*8),z:9.81+Math.sin(t*8)},rotationRate:{alpha:20*Math.sin(t*8),beta:10*Math.cos(t*8),gamma:0},interval:16.67}));if(n%20===0)await new Promise(resolve=>setTimeout(resolve,12))}}});
 await page.evaluate(()=>window.testFire(3600));await page.waitForTimeout(1200);
 const line=page.locator('.trajectory-layer polyline');if(await line.count()!==1)throw Error('Trajetória com mapa não apareceu');
 const corrected=await line.getAttribute('points');if(corrected.split(' ').length<3)throw Error('Trajetória corrigida vazia');
 const scale=await page.locator('.field').evaluate(e=>parseFloat(getComputedStyle(e).backgroundSize));
 const points=corrected.split(' ').map(v=>{const [x,y]=v.split(',').map(Number);return{x:x/scale+1,y:1-y/scale}});
 for(const p of points)if(p.x<0||p.x>10||p.y<0||p.y>8||(p.x>=4&&p.x<=6&&p.y>=3&&p.y<=5))throw Error('Ponto corrigido fora da área livre: '+JSON.stringify(p));
 if(await page.getByRole('button',{name:'Centralizar'}).count()||await page.getByRole('button',{name:/Ver (trajetória|original|com mapa)/}).count())throw Error('Botões Centralizar e Ver original/Ver com mapa deveriam ter sido removidos');
 await page.getByText('Sem caminho compatível com a sala.',{exact:false}).waitFor();
 for(const size of [{width:320,height:568},{width:568,height:320}]){await page.setViewportSize(size);const issue=await page.evaluate(()=>{const r=document.querySelector('.play').getBoundingClientRect();return document.documentElement.scrollHeight>innerHeight+1||r.bottom>innerHeight+1});if(issue)throw Error('Aviso ou botão fora da tela: '+JSON.stringify(size))}
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar trajetórias em CSV'}).click();const download=await downloadPromise;if(download.suggestedFilename()!=='trajetorias.csv')throw Error('Exportação incorreta');const stream=await download.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk.toString();if(!csv.includes('x_original_m')||!csv.includes('x_mapa_m')||!csv.split('\n').some(row=>row.endsWith(',,')))throw Error('CSV não preserva originais e falhas');
 await page.getByRole('button',{name:'Editar sala'}).click();await page.getByText('Para editar a sala, primeiro reinicie a sessão.').waitFor();
 return {sala:saved.width+' x '+saved.height,obstaculos:saved.obstacles.length,pontosCorrigidos:points.length,botoesRemovidos:'ok',csv:download.suggestedFilename(),validacao:'origem em obstáculo rejeitada',persistencia:'após recarga',mobile:'ok'};
}
