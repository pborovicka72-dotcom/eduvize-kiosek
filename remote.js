(async function(){
 'use strict';
 const R=window.EduvizeRemote,$=id=>document.getElementById(id),initial=location.hash.slice(1);
 history.replaceState(null,'',location.pathname+location.search);
 const capability=/^([\w-]{32})\.([\w-]{43})$/;
 let session,controller,state,stopped=true,busy=false,failures=0,lastMenu='',generation=0,stream=null,scanning=false,decoder,cameraGeneration=0;
 function say(value){$('status').textContent=value;}
 function stopScan(){cameraGeneration++;scanning=false;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$('camera').srcObject=null;$('scanner').hidden=true;}
 function end(message){generation++;stopped=true;controller=null;busy=false;stopScan();lastMenu='';$('menu').replaceChildren();$('leave').hidden=true;$('pairing').hidden=false;$('pairSubmit').disabled=false;$('hint').textContent='Spojení obnovíte pomocí aktuálního QR nebo párovacího kódu na kiosku.';say(message);}
 function draw(value){state=value;const key=JSON.stringify(value);if(key===lastMenu)return;lastMenu=key;$('screenTitle').textContent=value.title||'Kiosek';$('menu').replaceChildren();for(const item of value.items){const button=document.createElement('button');button.className='edu-admin__button remote-menu__item'+(item.active?'':' edu-admin__button--secondary');button.textContent=item.label;button.setAttribute('aria-pressed',String(!!item.active));button.disabled=busy;button.onclick=()=>send(item.id);$('menu').append(button);}}
 async function connect(credentials,code){
  const run=++generation;stopped=true;busy=true;stopScan();$('pairSubmit').disabled=true;say('Připojuji k obrazovce…');
  try{
   const joined=code?await R.request('/join-code',null,{code}):await R.request('/sessions/'+credentials[1]+'/join',credentials[2],{});
   if(run!==generation)return;
   session=code?joined.session:credentials[1];controller=joined.controller;stopped=false;busy=false;failures=0;lastMenu='';draw(joined.snapshot);
   $('pairCode').value='';$('pairing').hidden=true;$('leave').hidden=false;$('hint').textContent='Vybraná položka se otevře na velké obrazovce.';poll(run);
  }catch(e){if(run===generation)end(e.message);}finally{if(run===generation){busy=false;$('pairSubmit').disabled=false;}}
 }
 async function send(id){if(busy||stopped)return;const run=generation;busy=true;$('menu').querySelectorAll('button').forEach(b=>b.disabled=true);say('Odesílám volbu…');try{await R.request('/sessions/'+session+'/commands',controller,{id,revision:state.revision,requestId:crypto.randomUUID()});if(run===generation)say('Volba odeslána na obrazovku.');}catch(e){if(run!==generation)return;say(e.message);if([401,410].includes(e.status))end(e.message);}finally{if(run===generation){busy=false;$('menu').querySelectorAll('button').forEach(b=>b.disabled=false);}}}
 async function poll(run){if(stopped||run!==generation)return;try{const value=await R.request('/sessions/'+session+'/state',controller);if(run!==generation)return;draw(value.snapshot);$('menu').querySelectorAll('button').forEach(b=>b.disabled=busy);failures=0;if(!busy)say('Připojeno k obrazovce · vyberte položku');}catch(e){if(run!==generation)return;failures++;$('menu').querySelectorAll('button').forEach(b=>b.disabled=true);if([401,410].includes(e.status))return end(e.message);say('Spojení je přerušené. Zkouším znovu…');}if(!stopped&&run===generation)setTimeout(()=>poll(run),failures?3000:1500);}
 $('pairForm').onsubmit=event=>{event.preventDefault();if(busy)return;const code=$('pairCode').value.replace(/\s/g,'');if(!/^\d{8}$/.test(code)){say('Zadejte všech osm číslic párovacího kódu.');return;}connect(null,code);};
 $('leave').onclick=async()=>{if(busy)return;busy=true;const run=generation;try{await R.request('/sessions/'+session+'/leave',controller,{});if(run===generation)end('Ovládání bylo ukončeno.');}catch(e){if(run===generation){if([401,410].includes(e.status))end(e.message);else say(e.message);}}finally{if(run===generation)busy=false;}};
 function scanned(text){
  try{const u=new URL(text);if(u.origin!==location.origin||u.pathname!==location.pathname)throw Error();const match=u.hash.slice(1).match(capability);if(!match)throw Error();connect(match);}
  catch{$('scanStatus').textContent='Tento QR kód není párovací kód kiosku Eduvize.';}
 }
 async function loadDecoder(){
  if(window.jsQR)return window.jsQR;
  return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/jsQR.js?v=1.4.0';script.onload=()=>window.jsQR?resolve(window.jsQR):reject(Error('Čtečka QR se nenačetla. Použijte párovací kód.'));script.onerror=()=>{script.remove();reject(Error('Čtečka QR se nenačetla. Použijte párovací kód.'));};document.head.append(script);});
 }
 $('scan').onclick=async()=>{
  if(scanning||busy)return;
  if(!navigator.mediaDevices?.getUserMedia){say('Kamera není dostupná. Použijte párovací kód.');return;}
  const cameraRun=++cameraGeneration;scanning=true;$('scanner').hidden=false;$('scanStatus').textContent='Spouštím kameru…';
  try{
   decoder=await loadDecoder();if(!scanning||cameraRun!==cameraGeneration)return;
   const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(!scanning||cameraRun!==cameraGeneration){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;$('camera').srcObject=stream;await $('camera').play();if(!scanning||cameraRun!==cameraGeneration)return;
   $('scanStatus').textContent='Namiřte kameru na aktuální QR kód kiosku.';
   const frame=()=>{if(!scanning)return;const v=$('camera'),canvas=$('scanCanvas');if(v.readyState>=2&&v.videoWidth){const ratio=Math.min(1,960/v.videoWidth);canvas.width=Math.round(v.videoWidth*ratio);canvas.height=Math.round(v.videoHeight*ratio);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(v,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const found=decoder(pixels.data,pixels.width,pixels.height,{inversionAttempts:'dontInvert'});if(found){scanned(found.data);if(!scanning)return;}}setTimeout(frame,200);};frame();
  }catch(e){if(cameraRun!==cameraGeneration)return;stopScan();say(e.name==='NotAllowedError'?'Kamera není povolená. Použijte párovací kód.':e.message||'Kameru se nepodařilo spustit. Použijte párovací kód.');}
 };
 $('stopScan').onclick=stopScan;
 const match=initial.match(capability);if(match)await connect(match);else end('Připojte se k obrazovce QR nebo párovacím kódem.');
 window.addEventListener('pagehide',()=>{generation++;stopped=true;stopScan();});
 window.addEventListener('pageshow',e=>{if(e.persisted){if(controller){stopped=false;poll(++generation);}else end('Připojte se znovu k obrazovce.');}});
})();

