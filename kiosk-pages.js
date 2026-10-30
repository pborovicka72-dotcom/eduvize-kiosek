/* Menu hierarchy: creating a page also makes it reachable from its parent. */
(function(root){
  function create(config, parentId, id) {
    const parent=config.pages.find(page=>page.id===parentId)||config.pages.find(page=>page.id==='home');
    if(!parent)throw new Error('Chybí hlavní nabídka');
    let key=id||'page-'+Date.now();
    while(config.pages.some(page=>page.id===key))key+='-1';
    const page={id:key,title:'Nová podstránka',subtitle:'',buttons:[]};
    config.pages.push(page);
    parent.buttons ||= [];
    parent.buttons.push({label:page.title,type:'page',target:key});
    return page;
  }
  function rename(config,id,title){
    const page=config.pages.find(page=>page.id===id);
    if(!page)return;
    const old=page.title;
    page.title=title;
    for(const parent of config.pages)for(const button of parent.buttons||[]){
      if(button.type==='page'&&button.target===id&&button.label===old)button.label=title;
    }
  }
  function remove(config,id){
    if(id==='home')return false;
    config.pages=config.pages.filter(page=>page.id!==id);
    for(const page of config.pages)page.buttons=(page.buttons||[]).filter(button=>button.type!=='page'||button.target!==id);
    return true;
  }
  root.EduvizeKioskPages=Object.freeze({create,rename,remove});
})(window);
