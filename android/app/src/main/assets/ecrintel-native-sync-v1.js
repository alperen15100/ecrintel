(()=>{
 const KEY='ecrintel.alerts.breaking';
 const enabled=()=>localStorage.getItem(KEY)==='1';
 const push=()=>{try{window.EcrintelAndroid?.setCriticalAlerts(enabled())}catch{}};
 function wire(){
  const b=document.querySelector('#alertToggle');
  if(!b||b.dataset.nativeSync==='1')return;
  b.dataset.nativeSync='1';
  b.addEventListener('click',()=>setTimeout(push,0));
 }
 const mo=new MutationObserver(wire);
 mo.observe(document.documentElement,{subtree:true,childList:true});
 wire();setTimeout(()=>{wire();push()},800);
})();
