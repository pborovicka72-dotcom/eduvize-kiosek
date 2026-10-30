/* Seven destinations plus a final Next tile. Next cycles back to the first page. */
(function(root){
  function page(items,index=0){
    if(items.length<=8)return {items,index:0,hasMore:false,count:1,next:0};
    const count=Math.ceil(items.length/7),current=((Number(index)||0)%count+count)%count;
    return {items:items.slice(current*7,current*7+7),index:current,hasMore:true,count,next:(current+1)%count};
  }
  root.EduvizeKioskMenu=Object.freeze({page});
})(window);
