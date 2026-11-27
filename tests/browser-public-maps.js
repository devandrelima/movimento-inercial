// Credenciais do usuário inicial: TEST_USER e TEST_PASSWORD no ambiente (não ficam no repositório).
// Este roteiro publica e depois exclui um mapa público de nome único.
async page => {
 const env=typeof process!=='undefined'?process.env:{};const USER=env.TEST_USER,PASS=env.TEST_PASSWORD
 if(!USER||!PASS)throw Error('Defina TEST_USER e TEST_PASSWORD para testar o login.')
 const name='Teste automatizado '+Date.now()
 const modelRequests=[];page.on('request',r=>{if(r.url().includes('/models/'))modelRequests.push(r.url())})
 page.on('dialog',d=>d.accept())
 const results={}
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.reload()

 // 1) Teste de dispositivo: dura 3 s e, ao falhar, permite abrir o mapa sem sensores.
 const t0=Date.now();await page.getByRole('button',{name:'Testar sensores'}).click();await page.getByRole('alert').waitFor({timeout:9000})
 const seconds=(Date.now()-t0)/1000;if(seconds<2.8||seconds>4.8)throw Error('O teste deveria durar ~3 s, durou '+seconds.toFixed(1)+' s');results.duracaoTeste=seconds.toFixed(1)+' s'
 await page.getByRole('button',{name:'Abrir os mapas sem sensores'}).click()
 const play=page.getByRole('button',{name:'Iniciar coleta'}),reset=page.getByRole('button',{name:'Resetar dados'})
 await play.waitFor({timeout:5000})
 if(await play.getAttribute('aria-disabled')!=='true'||await reset.getAttribute('aria-disabled')!=='true')throw Error('Play e reset deveriam estar desabilitados')
 // aria-disabled: o Playwright só clica com force, mas um usuário real clica normalmente e vê o aviso.
 await play.click({force:true});await page.getByText('não consegue rodar o modelo',{exact:false}).waitFor({timeout:3000})
 await reset.click({force:true});await page.getByText('não consegue rodar o modelo',{exact:false}).waitFor({timeout:3000})
 if(await page.locator('dialog[open]').count())throw Error('Reset não deveria abrir a confirmação neste aparelho')
 if(await page.getByRole('button',{name:'Pausar coleta'}).count())throw Error('A coleta não deveria iniciar')
 if(modelRequests.length)throw Error('O modelo não deveria ser baixado em aparelho incompatível: '+modelRequests[0])
 results.modoSemSensores='play/reset desabilitados, aviso exibido, modelo não baixado'

 // 2) Criar e editar mapa localmente continua funcionando, sem login.
 await page.getByRole('button',{name:'Criar sala'}).click();await page.getByRole('button',{name:'Adicionar'}).click()
 await page.locator('.room-section').nth(0).getByLabel('Largura').fill('9');await page.getByRole('button',{name:'Salvar sala'}).click()
 await page.getByRole('button',{name:'Editar sala'}).waitFor()
 if(JSON.parse(await page.evaluate(()=>localStorage.getItem('norte-room-v1'))).width!==9)throw Error('Sala local não foi salva')
 results.localSemLogin='ok'

 // 3) Publicar exige login: senha errada é recusada; a correta abre a publicação.
 await page.getByRole('button',{name:'Editar sala'}).click();await page.getByRole('button',{name:'Publicar…'}).click()
 const login=page.getByRole('dialog',{name:'Entrar'});await login.waitFor()
 await login.getByLabel('Usuário').fill(USER);await login.getByLabel('Senha').fill('senha-errada-'+Date.now());await login.getByRole('button',{name:'Entrar'}).click()
 await login.getByRole('alert').waitFor();if(!(await login.getByRole('alert').innerText()).includes('incorretos'))throw Error('Mensagem de senha errada ausente')
 await login.getByLabel('Senha').fill(PASS);await login.getByRole('button',{name:'Entrar'}).click()
 const publish=page.getByRole('dialog',{name:'Publicar mapa'});await publish.waitFor()
 await publish.getByLabel('Nome do mapa').fill(name);await publish.getByRole('button',{name:'Publicar',exact:true}).click()
 await page.getByRole('button',{name:'Mapas públicos'}).waitFor()
 const link=await page.evaluate(()=>JSON.parse(localStorage.getItem('norte-room-link-v1')));if(link.name!==name)throw Error('Vínculo com o mapa público não foi salvo')
 results.publicar='login exigido; senha errada recusada; publicado'

 // 4) Outra pessoa, sem login, vê a lista e carrega o mapa; excluir pede login.
 const guest=await page.context().browser().newContext({viewport:{width:390,height:844}});const g=await guest.newPage();g.on('dialog',d=>d.accept())
 await g.goto(page.url());await g.getByRole('button',{name:'Testar sensores'}).click();await g.getByRole('alert').waitFor({timeout:9000})
 await g.getByRole('button',{name:'Abrir os mapas sem sensores'}).click();await g.getByRole('button',{name:'Mapas públicos'}).click()
 const row=g.locator('li',{hasText:name});await row.waitFor({timeout:8000})
 await row.getByRole('button',{name:'Excluir'}).click();const guestLogin=g.getByRole('dialog',{name:'Entrar'});await guestLogin.waitFor()
 await guestLogin.getByRole('button',{name:'Cancelar'}).click();await row.waitFor()
 const noScroll=await g.evaluate(()=>{const d=document.documentElement;return d.scrollWidth<=innerWidth&&d.scrollHeight<=innerHeight});if(!noScroll)throw Error('A lista de mapas rola a página no celular')
 await row.getByRole('button',{name:'Carregar'}).click();await g.getByRole('button',{name:'Editar sala'}).waitFor()
 const loaded=await g.evaluate(()=>JSON.parse(localStorage.getItem('norte-room-v1')));if(loaded.width!==9||loaded.obstacles.length!==1)throw Error('Mapa público não foi carregado')
 if(await g.evaluate(()=>sessionStorage.getItem('norte-session-v1')))throw Error('Visitante não deveria ter sessão')
 results.visitante='lista e carregamento sem login; exclusão exige login'
 await guest.close()

 // 5) Editar o mapa público: abre o editor vinculado e atualiza sem novo login (sessão ativa).
 await page.getByRole('button',{name:'Mapas públicos'}).click();await page.locator('li',{hasText:name}).getByRole('button',{name:'Editar'}).click()
 await page.locator('.room-section').nth(0).getByLabel('Largura').fill('11');await page.getByRole('button',{name:'Publicar…'}).click()
 const update=page.getByRole('dialog',{name:'Publicar mapa'});await update.waitFor()
 await update.getByRole('button',{name:'Atualizar',exact:true}).click();await page.getByRole('button',{name:'Mapas públicos'}).waitFor()
 const maps=await page.evaluate(async()=>(await (await fetch('/api/maps')).json()).maps);const mine=maps.filter(m=>m.name===name)
 if(mine.length!==1||mine[0].width!==11)throw Error('Atualização do mapa público não chegou ao servidor: '+JSON.stringify(mine))
 results.editar='atualizado no servidor (11 m), sem duplicar'

 // 6) Excluir o mapa público (logado) e conferir que sumiu.
 await page.getByRole('button',{name:'Mapas públicos'}).click();await page.locator('li',{hasText:name}).getByRole('button',{name:'Excluir'}).click()
 await page.getByText('excluído',{exact:false}).waitFor({timeout:8000})
 if((await page.evaluate(async()=>(await (await fetch('/api/maps')).json()).maps)).some(m=>m.name===name))throw Error('Mapa não foi excluído')
 results.excluir='removido do servidor'
 return results
}
