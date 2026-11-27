// Memória do dispositivo: teste aprovado e modelo instalado no navegador (usa o modelo e os sensores sintéticos reais).
async page => {
 const results={}
 const modelRequests=[];page.on('request',r=>{if(r.url().includes('/models/ronin-v2-float.tflite'))modelRequests.push(Date.now())})
 const feed=()=>page.evaluate(()=>{let i=0;window.checkFeed=setInterval(()=>{window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x:0,y:0,z:9.81},rotationRate:{alpha:0,beta:0,gamma:0},interval:16}));if(i++%3===0)window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false}))},10)})
 const ready=()=>page.getByRole('button',{name:'Iniciar coleta'}).and(page.locator('[aria-disabled]:not([aria-disabled="true"]), :not([aria-disabled])')).waitFor({timeout:60000})
 const state=()=>page.evaluate(async()=>({check:localStorage.getItem('norte-device-check-v1'),installed:localStorage.getItem('norte-model-installed-v1'),cached:await caches.open('norte-model-v1').then(c=>c.keys()).then(k=>k.map(r=>new URL(r.url).pathname))}))
 const loading=page.getByRole('heading',{name:'Preparando o modelo'})
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.reload()

 // 1) Primeira visita: teste (3 s) -> download do modelo -> grade. Depois disso o navegador lembra os dois.
 await page.getByRole('button',{name:'Testar sensores'}).click();await feed()
 await page.getByRole('button',{name:'Iniciar',exact:true}).waitFor({timeout:9000});await page.evaluate(()=>clearInterval(window.checkFeed))
 await page.getByRole('button',{name:'Iniciar',exact:true}).click();await loading.waitFor({timeout:5000})
 await ready()
 let s=await state();if(!s.check||!JSON.parse(s.check).ok)throw Error('Teste aprovado não foi lembrado');if(!s.installed||s.cached.join()!=='/models/ronin-v2-float.tflite')throw Error('Modelo não ficou instalado: '+JSON.stringify(s))
 if(modelRequests.length!==1)throw Error('Primeira visita deveria baixar o modelo uma vez: '+modelRequests.length)
 results.primeiraVisita='teste + download; teste e modelo lembrados'

 // 2) Reabrir: sem teste, sem tela de download, sem baixar o modelo de novo; direto na grade.
 modelRequests.length=0;await page.reload()
 if(await page.getByRole('button',{name:'Testar sensores'}).isVisible().catch(()=>false))throw Error('Não deveria pedir o teste de novo')
 await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:15000})
 if(await loading.isVisible().catch(()=>false)||await page.locator('.model-loading-progress').count())throw Error('Não deveria mostrar a tela de download')
 await ready();if(modelRequests.length)throw Error('Modelo foi baixado de novo ao reabrir: '+modelRequests.length)
 results.reabrir='direto na grade, modelo lido do armazenamento local (0 downloads)'

 // 3) Modelo instalado é de outra versão: pula o teste, mas vai para a tela de download.
 // (simula um deploy com modelo novo: o navegador tem outro arquivo, de outro hash, instalado antes)
 await page.evaluate(async()=>{localStorage.setItem('norte-model-installed-v1',JSON.stringify({hash:'0'.repeat(64),at:1}));await (await caches.open('norte-model-v1')).put('/models/ronin-v2-float.tflite',new Response(new Uint8Array([1,2,3,4])))});modelRequests.length=0;await page.reload()
 await loading.waitFor({timeout:5000})
 if(await page.getByRole('button',{name:'Testar sensores'}).count())throw Error('Versão antiga: o teste não deveria voltar')
 await ready();if(modelRequests.length!==1)throw Error('Versão diferente deveria baixar o modelo: '+modelRequests.length)
 s=await state();if(JSON.parse(s.installed).hash==='0'.repeat(64))throw Error('Registro do modelo não foi atualizado')
 results.versaoDiferente='pula o teste e baixa o modelo atual'

 // 3b) Registro antigo, mas o arquivo no cache é exatamente o modelo atual: reaproveita sem baixar e corrige o registro.
 await page.evaluate(()=>localStorage.setItem('norte-model-installed-v1',JSON.stringify({hash:'0'.repeat(64),at:1})));modelRequests.length=0;await page.reload()
 await ready();if(modelRequests.length)throw Error('Cópia íntegra no cache deveria ser reaproveitada: '+modelRequests.length)
 s=await state();if(JSON.parse(s.installed).hash==='0'.repeat(64))throw Error('Registro não foi corrigido')
 results.registroAntigoCacheIntegro='reaproveitado sem baixar'

 // 4) Cache apagado pelo navegador: também baixa de novo (sem teste).
 await page.evaluate(()=>caches.delete('norte-model-v1'));modelRequests.length=0;await page.reload()
 await loading.waitFor({timeout:5000});await ready()
 if(modelRequests.length!==1)throw Error('Cache apagado deveria baixar o modelo: '+modelRequests.length)
 results.cacheApagado='baixa de novo'

 // 5) Cópia corrompida no cache: é descartada pelo hash e o modelo íntegro é baixado; nada de erro para o usuário.
 await page.evaluate(async()=>{const c=await caches.open('norte-model-v1');await c.put('/models/ronin-v2-float.tflite',new Response(new Uint8Array(1000)))});modelRequests.length=0;await page.reload()
 await page.getByRole('button',{name:'Iniciar coleta'}).waitFor({timeout:15000});await ready()
 if(modelRequests.length!==1)throw Error('Cópia corrompida deveria ser substituída: '+modelRequests.length)
 if(await page.getByText('Não foi possível carregar o modelo').count())throw Error('Erro exibido por cópia corrompida')
 results.copiaCorrompida='descartada pelo hash e substituída'

 // 6) "Refazer teste" esquece a aprovação e volta ao teste.
 await page.getByRole('button',{name:'Refazer teste'}).click();await page.getByRole('button',{name:'Testar sensores'}).waitFor({timeout:10000})
 s=await state();if(s.check)throw Error('Aprovação deveria ter sido apagada')
 results.refazerTeste='volta ao teste'

 // 7) Falhar no teste não é lembrado.
 await page.getByRole('button',{name:'Testar sensores'}).click();await page.getByRole('alert').waitFor({timeout:9000})
 s=await state();if(s.check)throw Error('Teste reprovado não deveria ser lembrado')
 await page.reload();await page.getByRole('button',{name:'Testar sensores'}).waitFor({timeout:10000})
 results.reprovado='não é lembrado'
 return results
}
