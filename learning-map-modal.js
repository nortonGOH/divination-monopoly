/* Inline learning-map dialog; never navigates away from the homepage. */
(() => {
 'use strict';
 const dialog=document.getElementById('learningMapDialog');
 const opener=document.querySelector('.ux-quick-nav a[href="#learningMap"]');
 const close=document.getElementById('learningMapCloseBtn');
 const map=document.getElementById('learningMap');
 const panel=document.getElementById('learningMapAtlasPanel');
 const back=document.getElementById('learningMapAtlasBack');
 const frame=document.getElementById('learningMapAtlasFrame');
 if(!dialog||!opener||!close||!map||!panel||!back||!frame)return;
 let previous=null;
 function showMap(){
   panel.hidden=true;map.hidden=false;
   frame.removeAttribute('src');
 }
 function open(event){
   if(event)event.preventDefault();
   if(dialog.open)return;
   previous=document.activeElement;
   showMap();dialog.showModal();dialog.scrollTop=0;close.focus();
 }
 function hide(){if(dialog.open)dialog.close();}
 opener.addEventListener('click',open);
 close.addEventListener('click',hide);
 dialog.addEventListener('close',()=>{showMap();if(previous&&previous.isConnected)previous.focus();});
 dialog.addEventListener('click',event=>{if(event.target===dialog)hide();});
 dialog.addEventListener('click',event=>{
   const link=event.target.closest?.('a.learn-map-atlas');
   if(!link||!dialog.contains(link))return;
   const url=new URL(link.href,location.href);
   if(url.origin!==location.origin||!url.pathname.endsWith('/mansions-atlas.html'))return;
   event.preventDefault();
   frame.src=url.href;map.hidden=true;panel.hidden=false;dialog.scrollTop=0;back.focus();
 });
 back.addEventListener('click',()=>{showMap();dialog.scrollTop=0;close.focus();});
 // Support old bookmarked fragment without leaving the homepage.
 if(location.hash==='#learningMap')open();
})();
