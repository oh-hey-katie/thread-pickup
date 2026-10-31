import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../extension/discovery.js',import.meta.url),'utf8');
function setup({count=1,cloud=false,opened=false}={}) {
 const context=vm.createContext({URL});vm.runInContext(source,context);
 let clicks=0,moreClicks=0;
 const list={querySelectorAll:()=>[more]};
 const more={textContent:'Show more',getAttribute:()=>null,getClientRects:()=>[1],closest:s=>s==='[role="list"]'?list:null,click(){moreClicks++;}};
 const rows=Array.from({length:count},(_,i)=>{
  const attrs={'data-app-action-sidebar-project-id':String(i),'data-app-action-sidebar-project-label':`Project ${i}`,'data-app-action-sidebar-project-collapsed':String(!opened),role:'button','aria-expanded':String(opened)};
  const row={getAttribute:k=>attrs[k],getClientRects:()=>[1],closest:s=>s==='[role="list"]'?list:null,querySelectorAll:()=>cloud?[]:[toggle],click(){clicks++;attrs['data-app-action-sidebar-project-collapsed']='false';attrs['aria-expanded']='true';},attrs};
  const toggle={getAttribute:k=>k==='aria-label'?`Expand Project ${i}`:null,click:()=>row.click()};
  return row;
 });
 return {step:(now,url='https://chatgpt.com/')=>context.ThreadPickupDiscovery.step({querySelectorAll:()=>rows},url,now),rows,more,get clicks(){return clicks;},get moreClicks(){return moreClicks;}};
}
test('opens project toggles sequentially, then reveals more projects once',()=>{
 const s=setup({count:2});s.step(0);s.step(100);assert.equal(s.clicks,1);
 s.step(1100);assert.equal(s.clicks,2);s.step(2200);s.step(3300);assert.equal(s.moreClicks,1);
});
test('supports the project row toggle and respects later manual collapse',()=>{
 const s=setup({cloud:true});s.step(0);assert.equal(s.clicks,1);
 s.rows[0].attrs['data-app-action-sidebar-project-collapsed']='true';s.rows[0].attrs['aria-expanded']='false';
 s.step(2000);assert.equal(s.clicks,1);
});
test('does not reopen a project that was already open before discovery',()=>{
 const s=setup({opened:true});s.step(0);s.rows[0].attrs['data-app-action-sidebar-project-collapsed']='true';s.step(2000);assert.equal(s.clicks,0);
});
test('caps automatic project expansion at 25 per page load',()=>{
 const s=setup({count:30});for(let i=0;i<35;i++)s.step(i*1200);assert.equal(s.clicks,25);assert.equal(s.moreClicks,0);
});
test('ignores foreign, shared and authentication pages',()=>{
 const s=setup();for(const url of ['https://example.com/','https://chatgpt.com/share/test','https://chatgpt.com/auth/login'])s.step(0,url);assert.equal(s.clicks,0);assert.equal(s.moreClicks,0);
});
test('does not click Show more inside a nested chat list',()=>{
 const s=setup({opened:true});s.more.closest=()=>({});s.step(0);assert.equal(s.moreClicks,0);
});
