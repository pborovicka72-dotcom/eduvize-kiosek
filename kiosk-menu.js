/* Up to eight tiles: seven entries on the first/last page, six between Back and Next. */
(function(root){
  function groups(items){
    if(items.length<=8)return [items];
    const result=[items.slice(0,7)];let start=7;
    while(items.length-start>7){result.push(items.slice(start,start+6));start+=6;}
    if(start<items.length)result.push(items.slice(start));return result;
  }
  function page(items,index=0){
    const pages=groups(items),current=Math.max(0,Math.min(pages.length-1,Number(index)||0));
    const previous=current>0?current-1:null,next=current+1<pages.length?current+1:null;
    return {items:pages[current],index:current,hasMore:pages.length>1,count:pages.length,previous,next,slots:pages[current].length+(previous!==null?1:0)+(next!==null?1:0)};
  }
  function indexFor(items,index){const item=items[index];return Math.max(0,groups(items).findIndex(group=>group.includes(item)));}
  root.EduvizeKioskMenu=Object.freeze({page,indexFor});
})(window);
