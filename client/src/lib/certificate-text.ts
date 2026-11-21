import type jsPDF from 'jspdf';

// Canvas uses the browser's Unicode shaping and fallback fonts. jsPDF's built-in
// Helvetica cannot encode the names and course titles used by all 23 locales.
// Only variable text is rasterised; the background, QR and English labels stay
// unchanged. No network service or AI API is involved.
export function certificateText(doc:jsPDF,text:string,baseline:number,points:number,maxWidth=210){
 const value=text.replace(/\s+/g,' ').trim();
 if(!value)return;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Certificate text renderer unavailable');
 const scale=4,pxPerMm=96/25.4,maxPx=maxWidth*pxPerMm*scale;
 const font=(size:number)=>`600 ${size*96/72*scale}px Arial, "Noto Sans", sans-serif`;
 let size=points;ctx.font=font(size);
 while(ctx.measureText(value).width>maxPx&&size>10){size-=0.5;ctx.font=font(size);}
 // An unusually long name/title gets two lines instead of leaving the border.
 const words=value.includes(' ')?value.split(' '):Array.from(value),lines:string[]=[];
 let line='';
 for(const word of words){const next=line+(line&&value.includes(' ')?' ':'')+word;
  if(line&&ctx.measureText(next).width>maxPx){lines.push(line);line=word;}else line=next;
 }
 if(line)lines.push(line);
 const padding=8*scale,lineHeight=size*96/72*scale*1.25;
 canvas.width=Math.ceil(maxPx+padding*2);canvas.height=Math.ceil(lineHeight*lines.length+padding*2);
 ctx.font=font(size);ctx.fillStyle='#143591';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.direction=new RegExp('^[^\\p{L}]*[\\p{Script=Arabic}\\p{Script=Hebrew}]','u').test(value)?'rtl':'ltr';
 lines.forEach((line,index)=>ctx.fillText(line,canvas.width/2,padding+lineHeight*(index+.5),maxPx));
 const width=canvas.width/(pxPerMm*scale),height=canvas.height/(pxPerMm*scale);
 // Preserve each old text baseline, with extra lines extending equally around it.
 doc.addImage(canvas.toDataURL('image/png'),'PNG',148.5-width/2,baseline-height/2-size*25.4/72*.25,width,height);
}
