/* Only the shared published snapshot supplies content and identity. No legacy bootstrap. */
(function(root){
 'use strict';
 function create({document:doc,clock=root,layouts=root.EduvizeNSPLayouts}){
  const get=id=>doc.getElementById(id),main=get('kiosk'),menu=get('menu'),content=get('content'),status=get('status');
  let snapshot=null,pages=new Map(),media=new Map(),page='home',history=[],opened=false,timer=null,last=0,cleanupSignal=null,presentation=null;
  function node(tag,text){const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
  function cancelTimer(){if(timer!==null)clock.clearInterval(timer);timer=null;}
  function wipe(){for(const frame of content.querySelectorAll('iframe'))frame.src='about:blank';content.replaceChildren();opened=false;}
  function clear(){cancelTimer();cleanupSignal?.();cleanupSignal=null;wipe();menu.replaceChildren();main.hidden=true;status.hidden=false;status.textContent='Publikovaný kiosek není dostupný.';snapshot=null;pages.clear();media.clear();history=[];}
  function asset(id,image=false){
   const entry=media.get(id),prefix='/api/public/v1/outputs/'+snapshot.id+'/media/';
   if(!entry||entry.url!==prefix+id||!['image/jpeg','image/png','image/webp',...(image?[]:['application/pdf'])].includes(entry.mime))throw Error('Invalid scoped kiosk media');
   return entry;
  }
  function activity(){last=clock.Date?.now?.()??Date.now();}
  function nav(){
   const interactive=presentation.interaction==='interactive';
   get('navigation').hidden=!interactive||(!history.length&&!opened&&page===snapshot.payload.startPage);
   get('back').hidden=!history.length&&!opened;get('home').hidden=page===snapshot.payload.startPage&&!opened;
  }
  function draw(){
   wipe();const current=pages.get(page);if(!current)throw Error('Unknown kiosk page');
   get('title').textContent=current.title||snapshot.payload.title;menu.replaceChildren();
   for(const button of current.buttons){
    const el=node('button',button.label);el.type='button';el.dataset.buttonId=button.id;
    if(presentation.interaction!=='interactive'){el.disabled=true;el.tabIndex=-1;}
    el.onclick=()=>{activity();if(button.type==='page'){history.push(page);if(history.length>100)history.shift();page=button.pageId;draw();}
     else if(button.type==='media')openMedia(button.mediaId);};
    menu.append(el);
   }
   for(const section of current.sections){
    const card=node('section');card.className='section';
    if(section.title)card.append(node('h2',section.title));
    if(section.imageMediaId){const img=node('img');img.src=asset(section.imageMediaId,true).url;img.alt=section.title||'';card.append(img);}
    if(section.text)card.append(node('p',section.text));content.append(card);
   }
   const tiles=presentation.mode==='kiosk'&&presentation.kioskLayout==='tiles';
   content.hidden=tiles&&!current.sections.length;nav();
  }
  function openMedia(id){
   const entry=asset(id);wipe();content.hidden=false;opened=true;
   if(entry.mime==='application/pdf'){
    const frame=node('iframe');frame.title='Publikovaný dokument';frame.setAttribute('sandbox','');frame.setAttribute('referrerpolicy','no-referrer');frame.src=entry.url;content.append(frame);
   }else{const img=node('img');img.alt='Publikovaný obrázek';img.src=entry.url;content.append(img);}
   nav();
  }
  function home(){if(!snapshot)return;activity();history=[];page=snapshot.payload.startPage;draw();}
  get('home').onclick=home;
  get('back').onclick=()=>{if(!snapshot)return;activity();if(opened)draw();else{page=history.pop()||snapshot.payload.startPage;draw();}};
  function resize(){
   if(!presentation)return;
   const p=presentation,g=p.geometry;let w=clock.innerWidth,h=clock.innerHeight;
   if(p.mode==='nsp'){
    const rect=layouts?.layouts[g.orientation]?.[g.layoutId]?.[g.segmentId-1];
    if(!rect)throw Error('Unknown kiosk publication geometry');[w,h]=rect;
   }else if(p.mode==='kiosk'){w=g.width;h=g.height;}
   if(p.mode==='web'){Object.assign(main.style,{position:'',width:'',height:'',transform:'',left:'',top:''});}
   else Object.assign(main.style,{position:'absolute',width:w+'px',height:h+'px',left:'50%',top:'50%',transform:'translate(-50%,-50%) scale('+Math.min(clock.innerWidth/w,clock.innerHeight/h)+')',transformOrigin:'center'});
  }
  function apply(p,metrics){
   presentation=p;main.dataset.mode=p.mode;main.dataset.interaction=p.interaction;main.dataset.layout=p.kioskLayout||'menu';
   for(const [key,value] of Object.entries(metrics.header))main.style.setProperty('--edu-header-'+key,value+'px');
   for(const [key,value] of Object.entries(metrics.text))main.style.setProperty('--edu-text-'+key,value+'px');
   resize();
  }
  function render(value,metrics,{signal}={}){
   clear();
   try{
    if(value.appId!=='kiosk'||value.schemaVersion!==1||!/^[a-f0-9]{32}$/.test(value.id))throw Error('Unexpected kiosk publication');
    snapshot=value;pages=new Map(value.payload.pages.map(p=>[p.id,p]));media=new Map(value.media.map(m=>[m.id,m]));
    if(!pages.has('home')||!pages.has(value.payload.startPage))throw Error('Missing kiosk page');
    for(const p of pages.values()){
     for(const section of p.sections)if(section.imageMediaId)asset(section.imageMediaId,true);
     for(const b of p.buttons){if(b.type==='media')asset(b.mediaId);else if(b.type!=='page'||!pages.has(b.pageId))throw Error('Unsupported kiosk button');}
    }
    apply(value.presentation,metrics);main.dataset.menuPosition=value.payload.menuPosition;
    page=value.payload.startPage;history=[];activity();draw();main.hidden=false;status.hidden=true;
    if(value.payload.idleSeconds>0&&value.presentation.interaction==='interactive'){
     timer=clock.setInterval(()=>{if(snapshot&&(clock.Date?.now?.()??Date.now())-last>=snapshot.payload.idleSeconds*1000)home();},1000);
    }
    const abort=()=>{cancelTimer();wipe();};
    signal?.addEventListener('abort',abort,{once:true});cleanupSignal=()=>signal?.removeEventListener('abort',abort);
   }catch(error){clear();throw error;}
  }
  return Object.freeze({render,clear,apply,resize,activity});
 }
 root.EduvizeKioskPublished=Object.freeze({create});
 if(root.document){
  const view=create({document:root.document});
  root.addEventListener('resize',()=>{try{view.resize();}catch{view.clear();}});
  for(const event of ['pointerdown','keydown','touchstart'])root.document.addEventListener(event,view.activity);
  try{
   const runtime=root.EduvizeOutputRuntime.start({appId:'kiosk',render:view.render,clear:view.clear,onPresentation:view.apply});
   root.addEventListener('pagehide',()=>{runtime.stop();view.clear();});
   root.addEventListener('pageshow',event=>{if(event.persisted)root.location.reload();});
  }catch{view.clear();}
 }
})(window);
