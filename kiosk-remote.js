(function(){
 let started=false;
 function start(){
 const adapter=window.EduvizeKioskRemoteAdapter,R=window.EduvizeRemote;
 if(started||!adapter||!R)return;
 started=true;
 const preview=adapter.preview?.()===true;
 if(!preview&&!adapter.enabled())return;
 const host=document.createElement('div');host.className='kiosk-remote-pair';host.setAttribute('aria-label','Ovládání telefonem');
 const image=document.createElement('img');image.alt='QR kód pro ovládání této obrazovky telefonem';image.hidden=true;
 const pairCode=document.createElement('b');pairCode.className='kiosk-remote-code';pairCode.hidden=true;
 const details=document.createElement('div'),title=document.createElement('strong'),status=document.createElement('span'),disconnect=document.createElement('button');title.textContent='Ovládat telefonem';status.setAttribute('role','status');disconnect.className='edu-admin__button edu-admin__button--secondary';disconnect.textContent='Odpojit telefon';disconnect.hidden=true;details.append(title,pairCode,status,disconnect);host.append(image,details);const panel=document.getElementById('statusPanel');panel.append(host);new ResizeObserver(()=>{const h=panel.clientHeight;if(h>0){const size=Math.max(40,Math.min(180,h-76,panel.clientWidth*.22));image.style.height=size+'px';image.style.width=size+'px';}}).observe(panel);
 if(preview){
 host.classList.add('kiosk-remote-pair--preview');
 image.src='remote-preview.svg';image.alt='Ukázka QR kódu; párování telefonu je dostupné až ve výstupu.';
 title.textContent='Ovládat telefonem';pairCode.textContent='Kód: 1234 5678';pairCode.hidden=false;
 const syncPreview=()=>{host.hidden=adapter.previewEnabled?.()===false;image.hidden=host.hidden;};
 window.addEventListener('eduvize-kiosk-remote-update',syncPreview);
 syncPreview();
 return; // No pairing session or transport requests from the admin preview.
 }
 let session=null,ack=0,pair='',blobUrl='',stopped=false,failures=0;
 const snapshot=()=>{const value=adapter.snapshot();return {...value,revision:R.revision(value.items)};};
 async function refreshQR(value){const blob=await R.request('/sessions/'+session.id+'/qr',session.owner);if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(blob);image.src=blobUrl;image.hidden=false;pair=value;}
 disconnect.onclick=async()=>{disconnect.disabled=true;try{await R.request('/sessions/'+session.id+'/disconnect',session.owner,{});pair='';status.textContent='Telefon odpojen.';}catch(e){status.textContent=e.message;}finally{disconnect.disabled=false;}};
 async function tick(){if(stopped)return;try{
  if(!session){session=await R.request('/sessions',null,snapshot());ack=0;pair='';}
  const state=await R.request('/sessions/'+session.id+'/heartbeat',session.owner,{snapshot:snapshot(),ack});
  failures=0;pairCode.hidden=!!state.connected||!state.pairCode;pairCode.textContent=state.pairCode?'Kód: '+state.pairCode.slice(0,4)+' '+state.pairCode.slice(4):'';disconnect.hidden=!state.connected;host.classList.toggle('kiosk-remote-pair--connected',state.connected);
  if(state.connected){image.hidden=true;status.textContent='Telefon je připojený';}
  else{if(pair!==state.pairToken)await refreshQR(state.pairToken);image.hidden=false;status.textContent='Načtěte QR nebo zadejte kód';}
  for(const command of state.commands){if(command.sequence<=ack)continue;ack=command.sequence;const current=snapshot();if(command.revision===current.revision&&Date.now()-command.created*1000<5000)adapter.activate(command.id);}
 }catch(e){failures++;image.hidden=true;pairCode.hidden=true;status.textContent='Mobilní ovládání není dostupné';if([401,410].includes(e.status)){session=null;pair='';}}
 finally{if(!stopped)setTimeout(tick,Math.min(30000,failures?2000*2**Math.min(failures,4):1500));}}
 window.addEventListener('pagehide',()=>{stopped=true;if(blobUrl)URL.revokeObjectURL(blobUrl);});window.addEventListener('pageshow',e=>{if(e.persisted){stopped=false;tick();}});tick();
 }
 window.addEventListener('eduvize-kiosk-ready',start);
 start();
})();

