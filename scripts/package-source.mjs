import fs from 'node:fs';import {deflateRawSync} from 'node:zlib';
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=b=>{let crc=0xffffffff;for(const n of b)crc=crcTable[(crc^n)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
const collect=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collect(dir+'/'+entry.name):[dir+'/'+entry.name]);
export function packageSource(){
 const names=['LICENSE','README.md','EMAIL_SETUP.md','CONTRIBUTING.md','wrangler.example.jsonc','wrangler.jsonc','package.json','package-lock.json','index.html','app.js','source-seed.json','catalog.json','flower-rating-backup.json',...['worker','scripts','tests','drizzle','public'].flatMap(collect)].sort();
 const parts=[],central=[];let offset=0;
 for(const name of names){const filename=Buffer.from(name),content=fs.readFileSync(name),compressed=deflateRawSync(content),crc=crc32(content);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(filename.length,26);parts.push(local,filename,compressed);
 const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(8,10);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(compressed.length,20);entry.writeUInt32LE(content.length,24);entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);central.push(entry,filename);offset+=local.length+filename.length+compressed.length;}
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...parts,directory,end]);
}
