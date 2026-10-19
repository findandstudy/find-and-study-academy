import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
export const imageOptions={limitInputPixels:24000000,failOn:'error' as const,animated:false};
export const digest=(b:Buffer)=>crypto.createHash('sha256').update(b).digest('hex');
export async function localAssetPath(url:string,uploads=path.resolve('public/uploads'),maxBytes=250*1024*1024){
 if(typeof url!=='string'||!url.startsWith('/uploads/')||url.includes('?')||url.includes('#'))throw new Error('LOCAL_IMAGE_REQUIRED');
 const root=await fs.realpath(uploads);const abs=await fs.realpath(path.resolve(root,url.slice('/uploads/'.length)));
 if(!abs.startsWith(root+path.sep))throw new Error('INVALID_PATH');
 const stat=await fs.stat(abs);if(!stat.isFile()||stat.size>maxBytes)throw new Error('IMAGE_TOO_LARGE');return {abs,size:stat.size};
}
export async function localAsset(url:string,uploads=path.resolve('public/uploads')){const f=await localAssetPath(url,uploads,16000000);return fs.readFile(f.abs)}
export async function normalizeLogo(input:Buffer){
 if(!(input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(input[0]===255&&input[1]===216&&input[2]===255)||(input.subarray(0,4).toString()==='RIFF'&&input.subarray(8,12).toString()==='WEBP')))throw new Error('PNG_JPG_WEBP_ONLY');
 const meta=await sharp(input,imageOptions).metadata();if(!['png','jpeg','webp'].includes(meta.format||'')||(meta.pages||1)>1)throw new Error('PNG_JPG_WEBP_ONLY');
 if((meta.width||0)<48||(meta.height||0)<24)throw new Error('LOW_RESOLUTION');
 const original=await sharp(input,imageOptions).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).ensureAlpha().png().toBuffer();
 const raw=await sharp(original).raw().toBuffer({resolveWithObject:true});const {width:w,height:h}=raw.info;const data=Buffer.from(raw.data);const n=w*h;
 let transparent=0;for(let i=0;i<n;i++)if(data[i*4+3]<240)transparent++;
 if(transparent>n*.005)return {original,cleaned:await sharp(original).trim({threshold:5}).extend({top:4,bottom:4,left:4,right:4,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),method:'existing-alpha',warning:meta.width!<300?'LOW_RESOLUTION':null};
 // Remove only edge-connected, near-uniform background. Enclosed white logo details are preserved.
 const corners=[0,w-1,(h-1)*w,n-1];let bg=corners[0],best=0;
 const distance=(a:number,b:number)=>Math.sqrt([0,1,2].reduce((s,k)=>s+(data[a*4+k]-data[b*4+k])**2,0));
 for(const c of corners){const score=corners.filter(p=>distance(c,p)<38).length;if(score>best){best=score;bg=c}}
 if(best<3)return {original,cleaned:original,method:'complex-background',warning:'COMPLEX_BACKGROUND'};
 const seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0,removed=0;
 const enqueue=(i:number)=>{if(!seen[i]){seen[i]=1;if(distance(i,bg)<55){queue[tail++]=i;}}};
 for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x)}for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1)}
 while(head<tail){const i=queue[head++];data[i*4+3]=0;removed++;const x=i%w,y=Math.floor(i/w);if(x)enqueue(i-1);if(x<w-1)enqueue(i+1);if(y)enqueue(i-w);if(y<h-1)enqueue(i+w)}
 if(removed>n*.97||removed<n*.005)return {original,cleaned:original,method:'review-required',warning:'REVIEW_REQUIRED'};
 const cleaned=await sharp(data,{raw:{width:w,height:h,channels:4}}).trim({threshold:5}).extend({top:4,bottom:4,left:4,right:4,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 return {original,cleaned,method:'edge-connected-background',warning:'CHECK_DETAILS'};
}
export type Placement={x:number;y:number;width:number;height:number;backdrop:'none'|'white'|'black'};
export function validPlacement(p:any):p is Placement{return p&&['x','y','width','height'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))&&p.x>=0&&p.y>=0&&p.width>=.03&&p.height>=.03&&p.width<=.6&&p.height<=.5&&p.x+p.width<=1.001&&p.y+p.height<=1.001&&['none','white','black'].includes(p.backdrop)}
export async function composeLogo(image:Buffer,logo:Buffer,p:Placement,preview=false){
 if(!validPlacement(p))throw Error('INVALID_PLACEMENT');const base=await sharp(image,imageOptions).rotate().png().toBuffer();const m=await sharp(base).metadata();const w=m.width!,h=m.height!;
 const bx=Math.floor(p.x*w),by=Math.floor(p.y*h),bw=Math.max(1,Math.floor(p.width*w)),bh=Math.max(1,Math.floor(p.height*h));const pad=p.backdrop==='none'?0:Math.max(2,Math.round(Math.min(bw,bh)*.07));
 const mark=await sharp(logo,imageOptions).resize({width:Math.max(1,bw-pad*2),height:Math.max(1,bh-pad*2),fit:'inside'}).png().toBuffer({resolveWithObject:true});const layers:any[]=[];
 if(p.backdrop!=='none')layers.push({input:await sharp({create:{width:bw,height:bh,channels:4,background:p.backdrop}}).png().toBuffer(),left:bx,top:by});
 layers.push({input:mark.data,left:bx+Math.floor((bw-mark.info.width)/2),top:by+Math.floor((bh-mark.info.height)/2)});
 let result=sharp(base).composite(layers);if(preview)result=result.resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true});return result.png().toBuffer();
}
export function materialInfo(item:any){const raw=String(item.displayName||item.title||'');const format=/(?:^|[_ -])(story|post)(?:[_ .-]|$)/i.exec(raw)?.[1]?.toLowerCase()||'other';const language=/(?:^|[_ -])(en|tr|ar|fa|es|fr|ru|id|hi|zh|it|pt|uk|ur|bn|ne|tk|uz|kk|ky|tg|vi|ko)(?:\.[a-z0-9]+)?$/i.exec(raw)?.[1]?.toLowerCase()||'unknown';return {format,language,name:raw.replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()};}
