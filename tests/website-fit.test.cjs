const {readFileSync}=require('node:fs');
const vm=require('node:vm');const assert=require('node:assert/strict');
const source=readFileSync(__dirname+'/../index.html','utf8');
const fn=source.slice(source.indexOf('function fitWebsite(){'),source.indexOf("window.addEventListener('resize',()=>requestAnimationFrame(fitWebsite));"));
function run({width=3840,menu=false,right=false,mode='kiosk',app=false,image=false,userZoom=1}={}){
 const values={},classes=new Set(menu?['menu-layout',...(right?['menu-right']:[])]:[]);
 const frame={src:'https://school.example/',dataset:{websiteZoom:String(userZoom)},classList:{contains:()=>false}};
 const wrap={clientWidth:width};const style={gridTemplateColumns:right?'2800px 600px':'600px 2800px',paddingLeft:'14px',paddingRight:'14px'};
 const context={URL,inFrame:true,window:{EduvizeOutputModes:{mode:()=>mode},EduvizeKioskApps:{identify:()=>app,isImageViewer:()=>image}},$:()=>frame,getComputedStyle:()=>style,document:{body:{classList:{contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)}},documentElement:{style:{setProperty:(k,v)=>values[k]=v}},querySelector:()=>wrap}};
 vm.createContext(context);vm.runInContext(fn+'fitWebsite();fitWebsite();',context);return values;
}
assert.equal(Number(run()['--embedded-scale']),3812/1280);
assert.equal(Number(run({menu:true})['--embedded-scale']),2800/1280);
assert.equal(Number(run({menu:true,right:true})['--embedded-scale']),2800/1280);
assert.equal(Number(run({width:1080})['--embedded-scale']),1);
for(const args of [{mode:'web'},{app:true},{image:true}])assert.deepEqual(run(args),{});
console.log('Website fit: 7 cases passed, including repeated fitting and excluded outputs');
