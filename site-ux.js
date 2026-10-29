/* Small, progressive page-navigation enhancement. No Supabase/network calls. */
(()=>{
  'use strict';
  const back=document.getElementById('uxBackTop');
  if(!back)return;
  const update=()=>{
    back.hidden=window.scrollY<420;
  };
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update,{passive:true});
  back.addEventListener('click',()=>{
    // Native anchor navigation keeps keyboard and screen-reader behavior.
    back.hidden=true;
  });
  update();
})();
