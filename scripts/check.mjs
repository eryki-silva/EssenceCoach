import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const roots=['api','backend','public','scripts','test'];
const files=['server.mjs','launch.mjs'];
async function walk(root){for(const entry of await readdir(root,{withFileTypes:true})){const path=root+'/'+entry.name;if(entry.isDirectory())await walk(path);else if(/\.(?:mjs|js)$/.test(path))files.push(path);}}
for(const root of roots)await walk(root);
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){console.error(file+'\n'+result.stderr);process.exit(1);}}
console.log('Sintaxe válida em '+files.length+' módulos.');
