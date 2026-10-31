import {mkdir,cp,rm,readdir,lstat,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const allowed=['README.md','LICENSE','package.json','.gitignore','public','desktop','extension','tests','scripts','docs'];
const release=path.join(root,'release'),stage=path.join(release,'thread-pickup');
// Reject symlinks so packaging cannot accidentally follow private files outside this tree.
async function inspect(file){const stat=await lstat(file);if(stat.isSymbolicLink())throw Error(`Refusing symlink: ${path.relative(root,file)}`);if(stat.isDirectory())for(const entry of await readdir(file))await inspect(path.join(file,entry));}
const demo=JSON.parse(await readFile(path.join(root,'public/demo.json'),'utf8'));
if(demo.id!=='recall-fictional-demo'||!demo.chats.every(c=>c.id.startsWith('demo-')&&!c.url))throw Error('Demo must contain fictional records only.');
await mkdir(release,{recursive:true});await rm(stage,{recursive:true,force:true});await mkdir(stage);
for(const name of allowed){await inspect(path.join(root,name));await cp(path.join(root,name),path.join(stage,name),{recursive:true});}
// Source archives must not expose the builder's OS username, IDs, or extended attributes.
const tarVersion=execFileSync('tar',['--version'],{encoding:'utf8'});
const metadataFlags=tarVersion.includes('bsdtar')
 ? ['--format','ustar','--uid','0','--gid','0','--uname','root','--gname','root','--no-xattrs','--no-acls','--no-fflags','--no-mac-metadata']
 : ['--format=ustar','--owner=0','--group=0','--numeric-owner'];
execFileSync('tar',[...metadataFlags,'-czf',path.join(release,'thread-pickup-source.tar.gz'),'-C',release,'thread-pickup'],{env:{...process.env,COPYFILE_DISABLE:'1'}});
await rm(stage,{recursive:true,force:true});
console.log('Created release/thread-pickup-source.tar.gz from reviewed source folders. No private data or generated builds included.');
