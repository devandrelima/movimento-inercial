async page => {
 await page.evaluate(()=>Object.defineProperty(DeviceMotionEvent,'requestPermission',{configurable:true,value:()=>Promise.resolve('denied')}));
 await page.getByRole('button',{name:'Testar sensores'}).click();await page.getByRole('alert').waitFor();
 const message=await page.getByRole('alert').innerText();if(!message.includes('negada'))throw Error(message);
 if(await page.getByRole('button',{name:'Iniciar',exact:true}).count())throw Error('Botão iniciar apareceu sem permissão');
 return {permissao:message};
}
