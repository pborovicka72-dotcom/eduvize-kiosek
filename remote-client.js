/* Shared transport only; the pairing capability stays in the URL fragment and memory. */
(function(root){
 const API=root.EduvizeKioskEnvironment.url('/api/kiosk-remote');
 async function request(path,token,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(API+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',credentials:'same-origin',signal:controller.signal});if(!r.ok){const e=Error((await r.json().catch(()=>({}))).detail||'Spojení se nepodařilo navázat.');e.status=r.status;throw e;}return r.headers.get('content-type')?.includes('image/')?r.blob():r.json();}catch(e){if(e.name==='AbortError')throw Error('Kiosek neodpovídá. Zkontrolujte připojení.');throw e;}finally{clearTimeout(timer);}}
 function revision(items){let n=2166136261;for(const ch of JSON.stringify(items.map(({id,label})=>[id,label]))){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(16);}
 root.EduvizeRemote=Object.freeze({request,revision});
})(window);
