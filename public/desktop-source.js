import {isHidden} from './model.js';
export function desktopQueue(chats,dismissed={}) {
 const rows=chats.filter(c=>!isHidden(c,dismissed)).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
 const chosen=new Map(rows.filter(c=>c.pinned).map(c=>[c.id,c]));const projects=new Set();
 for(const chat of rows)if(chat.project&&!projects.has(chat.project.id)){projects.add(chat.project.id);chosen.set(chat.id,chat);}
 for(const chat of rows)if(!chat.project)chosen.set(chat.id,chat);
 return [...chosen.values()].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
export async function fetchDesktop(path='/api/desktop') {
 const response=await fetch(path,{cache:'no-store',credentials:'omit',headers:{'X-Thread-Pickup':'1'}});
 if(!response.ok)throw new Error('Desktop reader unavailable');return response.json();
}
