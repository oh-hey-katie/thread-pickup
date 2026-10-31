import {spawnSync} from 'node:child_process';
import {findBinary} from '../desktop/service.mjs';
const major=Number(process.versions.node.split('.')[0]);
console.log(`Node.js ${process.versions.node}: ${major>=22?'OK':'requires version 22 or newer'}`);
const binary=await findBinary();const result=spawnSync(binary,['--version'],{encoding:'utf8',timeout:10000});
if(result.status!==0){console.error('Desktop command not found. Install ChatGPT Desktop or Codex, or set THREAD_PICKUP_CODEX to the executable path.');process.exitCode=1;}
else console.log(`Desktop command: ${result.stdout.trim()}\nReady to try npm start. Compatibility is checked again when history loads.`);
if(major<22)process.exitCode=1;
