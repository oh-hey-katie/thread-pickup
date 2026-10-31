const frame=document.getElementById('shelf'),play=document.getElementById('play'),caption=document.getElementById('caption');
let timers=[];
const at=(ms,fn)=>timers.push(setTimeout(fn,ms));
play.onclick=()=>{
 timers.forEach(clearTimeout);timers=[];play.disabled=true;play.textContent='Playing…';
 // Reload only the fictional frame. No desktop API or real chat is used by this tour.
 frame.src='./?demo=1';
 frame.onload=()=>{
  frame.onload=null;
  const doc=frame.contentDocument;
  const say=text=>caption.textContent=text;
  say('01 / Your conversations, arranged so you can find your place.');
  at(5000,()=>{doc.querySelector('.card-body')?.click();say('02 / Open a card to see where you left off and what comes next.');});
  at(12000,()=>{doc.querySelector('#detail-dialog [data-close]')?.click();doc.querySelector('.hide-card')?.click();say('03 / Set a chat aside. The next conversation takes its place.');});
  at(19000,()=>{doc.getElementById('undo-button')?.click();say('04 / Changed your mind? Undo brings it right back.');});
  at(25000,()=>{doc.getElementById('toast-close')?.click();say('05 / In desktop mode, saved conversations refresh automatically. No exports or per-chat saving.');});
  at(30000,()=>{play.disabled=false;play.textContent='Replay the tour';say('Your chats stay in the desktop app. Thread pickup helps you find your place.');});
 };
};
