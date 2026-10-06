export const SIZE = { width: 1240, height: 1450 };
export const COLORS = { power:'#252a30', command:'#bdc9cc', zero:'#32a5ef', positive:'#965d37', untagged:'#30343a' };
export const escapeXML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

export function makeModel(data) {
  const ports=new Map(), edges=[], devices=new Map();
  function device(id,name,x,y,w,h,type){const d={id,name,x,y,w,h,type};devices.set(id,d);return d;}
  function port(id,deviceId,pin,x,y,side='top',label,extra={}){ports.set(id,{id,device:deviceId,pin,x,y,side,label:label||`${deviceId} · ${pin}`,...extra});return id;}
  function wire(tag,from,to,route='auto',extra={}){
    if(!ports.has(from)||!ports.has(to))throw new Error(`Borne inexistente: ${from} / ${to}`);
    const color=tag==='0VCC'?COLORS.zero:tag==='24VCC'?COLORS.positive:tag?.startsWith('W0')?COLORS.command:tag===null?COLORS.untagged:COLORS.power;
    const e={id:`e${edges.length}`,tag,from,to,route,color,kind:'wire',...extra};edges.push(e);return e;
  }
  const d1=device('D1','Schneider · bipolar',136,200,134,260,'breaker');
  const d2=device('D2','WEG · monopolar',286,200,65,260,'breaker');
  const d3=device('D3','Schneider · bipolar',363,200,134,260,'breaker');
  for(const d of [d1,d3]){
    port(`${d.id}.inL`,d.id,'entrada esquerda',d.x+34,d.y,'top');port(`${d.id}.inN`,d.id,'entrada direita',d.x+100,d.y,'top');
    port(`${d.id}.outL`,d.id,'saída esquerda',d.x+34,d.y+d.h,'bottom');port(`${d.id}.outN`,d.id,'saída direita',d.x+100,d.y+d.h,'bottom');
  }
  port('D2.in','D2','entrada',318,200,'top');port('D2.out','D2','saída',318,460,'bottom');
  const ts=device('TS','Techno Safe',525,229,254,220,'techno');
  for(let n=1;n<=24;n++)port(`TS.${n}`,'TS',String(n),ts.x+17+((n-1)%12)*20, n<=12?ts.y+ts.h:ts.y,n<=12?'bottom':'top');
  const ra=device('RA','Omron · auxiliar',808,280,55,173,'relay');
  port('RA.21','RA','21',807,304,'left');port('RA.22','RA','22',807,342,'left');port('RA.24','RA','24',807,380,'left');
  port('RA.A1','RA','A1',821,453,'bottom');port('RA.A2','RA','A2',850,453,'bottom');
  const rs=device('RS','Omron G9SE-201',888,118,94,410,'safety');
  // Functional grouping of the official terminals; this is a schematic front view.
  const rpos={A1:[904,199],A2:[966,199],T11:[904,250],T12:[904,284],T21:[966,250],T22:[966,284],T31:[904,336],T32:[904,370],T33:[966,336],X1:[966,370],13:[904,442],14:[904,480],23:[966,442],24:[966,480]};
  for(const t of data.g9se.terminals){const [x,y]=rpos[t.id];port(`RS.${t.id}`,'RS',t.id,x,y,x<935?'left':'right',`G9SE · ${t.id}`,{function:t.function});}
  const psu=device('F','Omron S8VK-C12024',1005,118,106,420,'psu');
  port('F.plus','F','+24V',1030,118,'top','Fonte · +24 VCC');port('F.minus','F','0V',1088,118,'top','Fonte · 0 VCC');
  port('F.L','F','L',1025,538,'bottom','Fonte · L');port('F.N','F','N',1056,538,'bottom','Fonte · N');port('F.PE','F','PE',1087,538,'bottom','Fonte · terra');
  for(let i=1;i<=3;i++){
    const d=device(`C${i}`,`Schneider Easy TeSys · ${i}`,129+(i-1)*228,700,220,304,'contactor');
    for(const [pin,dx,dy,side] of [['1L1',40,0,'top'],['3L2',108,0,'top'],['5L3',176,0,'top'],['13',62,63,'top'],['A1',198,63,'top'],['53',27,124,'top'],['61',79,124,'top'],['71',131,124,'top'],['83',183,124,'top'],['54',27,226,'bottom'],['62',79,226,'bottom'],['72',131,226,'bottom'],['84',183,226,'bottom'],['14',62,260,'bottom'],['A2',198,260,'bottom'],['2T1',40,304,'bottom'],['4T2',108,304,'bottom'],['6T3',176,304,'bottom']])port(`${d.id}.${pin}`,d.id,pin,d.x+dx,d.y+dy,side);
  }
  device('B','Borneira principal',134,1248,650,112,'terminals');
  const strip=['R1','S1','T1','24a','24b','24c','0a','0b','W003',null,null,'W005','W004',null,null,'W006','W007','W008','W009','W016','W017','W021','W022','W011','W036','W038'];
  strip.forEach((tag,i)=>{if(!tag)return;const text=tag.startsWith('24')?'24VCC':tag.startsWith('0')?'0VCC':tag;const x=146+i*25;port(`B.${tag}.t`,'B',text,x,1248,'top',`Borneira · ${text} (superior)`,{stripIndex:i});port(`B.${tag}.b`,'B',text,x,1360,'bottom',`Borneira · ${text} (inferior)`,{stripIndex:i});});
  for(const tag of ['0a','0b','W003','W004','W005','W006','W016','W017','W021','W022'])wire(null,`B.${tag}.t`,`B.${tag}.b`,'straight',{kind:'junction',color:'#67787a'});
  for(const [a,b] of [['24a','24b'],['24b','24c'],['0a','0b']])wire(null,`B.${a}.t`,`B.${b}.t`,'straight',{kind:'junction',color:'#aa4741'});
  device('BM','Bornes U1 · V1 · W1',895,1248,76,112,'terminals');
  for(const [i,tag] of ['U1','V1','W1'].entries())port(`BM.${tag}`,'BM',tag,907+i*25,1248,'top',`Borne · ${tag}`);
  device('PE','Terra',1070,1248,35,112,'earth');
  // Door components are in a clearly labelled inset, not on the mounting plate.
  device('P','Porta · vista interna',852,756,240,266,'door');
  port('P.L22','P','sinaleiro esquerdo · W022',908,827,'left','Sinaleiro esquerdo · W022');port('P.L0','P','sinaleiro esquerdo · 0VCC',944,827,'right','Sinaleiro esquerdo · 0VCC');
  port('P.R21','P','sinaleiro direito · W021',1004,827,'left','Sinaleiro direito · W021');port('P.R0','P','sinaleiro direito · 0VCC',1040,827,'right','Sinaleiro direito · 0VCC');
  port('P.B16','P','botão · W016',935,906,'left','Botão · borne de W016');port('P.B17','P','botão · W017',1009,906,'right','Botão · borne de W017');
  port('P.NCL1','P','NC esquerdo · 1',914,967,'top','Botão de dois contatos · NC esquerdo 1');port('P.NCL2','P','NC esquerdo · 2',914,1018,'bottom','Botão de dois contatos · NC esquerdo 2');
  port('P.NCR1','P','NC direito · 1',1031,967,'top','Botão de dois contatos · NC direito 1');port('P.NCR2','P','NC direito · 2',1031,1018,'bottom','Botão de dois contatos · NC direito 2');
  port('T1.unknown','pending','outra ponta de T1',92,1207,'left','T1 · outra ponta a confirmar',{missing:true});
  port('T2.loose','pending','ponta aparentemente solta',338,147,'top','T2 · ponta solta próxima ao WEG',{missing:true});

  wire('R1','B.R1.t','D1.inL','left-long',{logical:true});wire('R1','B.R1.t','D3.inL','left-long',{logical:true});
  wire('S1','B.S1.t','D1.inN','left-long',{logical:true});wire('S1','B.S1.t','D3.inN','left-long',{logical:true});
  wire('T1','B.T1.t','T1.unknown','left-long',{missing:true});
  wire('R2','D1.outL','C1.1L1','middle');wire('R2','D1.outL','F.L','middle');
  wire('S2','D1.outN','C1.3L2','middle');wire('S2','D1.outN','F.N','middle');wire('T2','T2.loose','C1.5L3','left-long',{missing:true});
  wire('R3','C1.1L1','C2.5L3','input-jump',{confirmed:true});wire('S3','C1.3L2','C2.3L2','input-jump',{confirmed:true});wire('T3','C1.5L3','C2.1L1','input-jump',{confirmed:true});
  wire('R5','D3.outL','TS.1','middle');wire('S5','D3.outN','TS.5','middle');wire('R6','TS.3','C3.1L1','middle');wire('S6','TS.6','C3.3L2','middle');wire('T6','C3.3L2','C3.5L3','input-jump',{confirmed:true});
  for(const [tag,pin,bPin] of [['U1','2T1','U1'],['V1','4T2','V1'],['W1','6T3','W1']]){
    for(let i=1;i<3;i++)wire(null,`C${i}.${pin}`,`C${i+1}.${pin}`,'output-jump',{bus:tag,confirmed:true});
    wire(tag,`C3.${pin}`,`BM.${bPin}`,'lower',{bus:tag,confirmed:true});
  }
  const safety=[['W003','T11','NCL1'],['W004','T21','NCR1'],['W005','T12','NCL2'],['W006','T22','NCR2']];
  for(const [tag,pin,door] of safety){wire(tag,`RS.${pin}`,`B.${tag}.t`,'right');wire(tag,`B.${tag}.b`,`P.${door}`,'door');}
  wire('W007','RS.24','B.W007.t','right');wire('W008','B.W008.t','C1.13','lower');
  wire('W009','C1.14','B.W009.t','lower');wire('W009','C1.14','TS.19','right');
  wire('W010','TS.20','C3.71','right');wire('W011','C3.72','B.W011.t','lower');
  wire('W012','TS.15','C1.53','right');wire('W013','C1.54','TS.16','right');wire('W014','TS.18','C1.61','right');wire('W015','C1.62','C3.A1','middle');
  wire('W016','RS.T31','B.W016.t','right');wire('W016','B.W016.b','P.B16','door');
  wire('W017','TS.21','B.W017.t','right');wire('W017','B.W017.b','P.B17','door');
  wire('W018','RS.T32','TS.22','top-short');wire('W020','RS.X1','RA.A1','middle');
  wire('W021','RA.24','B.W021.t','right');wire('W021','B.W021.b','P.R21','door');
  wire('W022','RA.22','B.W022.t','right');wire('W022','B.W022.b','P.L22','door');
  wire('W036','B.W036.t','C2.61','lower');wire('W037','C2.62','C1.A1','middle');wire('W038','B.W038.t','C1.71','lower');wire('W039','C1.72','C2.A1','middle');
  // Distribution paths indicate known points sharing a tag; exact duct routes are not asserted.
  wire('0VCC','F.minus','B.0a.t','right',{logical:true});
  for(const id of ['TS.14','RA.A2','RS.A2','RS.13','RS.14','C1.A2','C2.A2','C3.A2'])wire('0VCC','B.0a.t',id,'right',{logical:true});
  wire('0VCC','B.0a.b','P.L0','door',{logical:true});wire('0VCC','B.0b.b','P.R0','door',{logical:true});
  wire('24VCC','F.plus','D2.in','top-short',{logical:true});wire('24VCC','D2.out','B.24a.t','right',{logical:true});
  for(const id of ['TS.13','TS.17','RA.21','RS.A1','RS.T33','RS.23'])wire('24VCC','B.24a.t',id,'right',{logical:true});

  function select(tag,related=true){
    const direct=edges.filter(e=>tag==='__untagged'?e.tag===null&&e.kind==='wire':e.tag===tag);
    const directIds=new Set(direct.map(e=>e.id)), directNodes=new Set(direct.flatMap(e=>[e.from,e.to]));
    const reached=new Set(directNodes), allIds=new Set(directIds);
    if(related){let again=true;while(again){again=false;for(const e of edges){if(reached.has(e.from)||reached.has(e.to)){allIds.add(e.id);for(const id of [e.from,e.to])if(!reached.has(id)){reached.add(id);again=true;}}}}}
    return {tag,direct,directIds,directNodes,edges:edges.filter(e=>allIds.has(e.id)),nodes:reached,related:edges.filter(e=>allIds.has(e.id)&&!directIds.has(e.id)&&e.kind==='wire')};
  }
  function routePoints(e){
    const a=ports.get(e.from),b=ports.get(e.to),k=Number(e.id.slice(1));
    const lane=(k%9)*7;
    if(e.route==='straight')return [[a.x,a.y],[b.x,b.y]];
    if(e.route==='input-jump'){const y=651+(k%4)*10;return [[a.x,a.y],[a.x,y],[b.x,y],[b.x,b.y]];}
    if(e.route==='output-jump'){const y=1030+['U1','V1','W1'].indexOf(e.bus)*14;return [[a.x,a.y],[a.x,y],[b.x,y],[b.x,b.y]];}
    if(e.route==='left-long'){const x=91+(k%4)*11;return [[a.x,a.y],[a.x,a.y>1100?1190:166],[x,a.y>1100?1190:166],[x,b.y<500?156:601],[b.x,b.y<500?156:601],[b.x,b.y]];}
    if(e.route==='middle'){const y=575+lane;return [[a.x,a.y],[a.x,y],[b.x,y],[b.x,b.y]];}
    if(e.route==='lower'){const y=1166+lane;return [[a.x,a.y],[a.x,y],[b.x,y],[b.x,b.y]];}
    if(e.route==='top-short'){const y=153+(k%5)*8;return [[a.x,a.y],[a.x,y],[b.x,y],[b.x,b.y]];}
    if(e.route==='door'){const x=1130+(k%5)*10;const y=1394+(k%4)*6;return [[a.x,a.y],[a.x,y],[x,y],[x,b.y],[b.x,b.y]];}
    const x=1126+(k%8)*9;
    const ay=a.y>1100?1180:a.side==='top'?166:555+lane;
    const by=b.y>1100?1180:b.device.startsWith('C')?(b.y>=920?1060:680):b.side==='top'?166:555+lane;
    return [[a.x,a.y],[a.x,ay],[x,ay],[x,by],[b.x,by],[b.x,b.y]];
  }
  return {data,ports,edges,devices,strip,select,routePoints};
}

const rect=(x,y,w,h,fill,stroke,rx=3,more='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke?` stroke="${stroke}"`:''} ${more}/>`;
const text=(x,y,value,fill='#d7e3e4',size=12,extra='')=>`<text x="${x}" y="${y}" fill="${fill}" font-family="Inter,Segoe UI,sans-serif" font-size="${size}" ${extra}>${escapeXML(value)}</text>`;
const circle=(x,y,r,fill,stroke)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke||'none'}"/>`;

export function baseDrawing(model){
  let s=`<defs><linearGradient id="plate" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#b95c28"/><stop offset=".5" stop-color="#97451c"/><stop offset="1" stop-color="#ad5529"/></linearGradient><linearGradient id="duct" x2="0" y2="1"><stop stop-color="#667479"/><stop offset=".45" stop-color="#4a5a60"/><stop offset="1" stop-color="#35464d"/></linearGradient><linearGradient id="deviceWhite" x2="0" y2="1"><stop stop-color="#e9e9dd"/><stop offset="1" stop-color="#adbbb5"/></linearGradient><linearGradient id="contactor" x2="0" y2="1"><stop stop-color="#798d8d"/><stop offset=".5" stop-color="#526d6d"/><stop offset="1" stop-color="#3b575c"/></linearGradient><linearGradient id="rail" x2="0" y2="1"><stop stop-color="#9caba7"/><stop offset=".45" stop-color="#495959"/><stop offset=".55" stop-color="#bcc4b9"/><stop offset="1" stop-color="#657770"/></linearGradient><pattern id="ductSlots" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="#33474e"/><rect x="6" width="13" height="18" rx="2" fill="#182b31"/></pattern><filter id="deviceShadow" x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx="3" dy="5" stdDeviation="4" flood-opacity=".4"/></filter></defs>`;
  s+=rect(62,61,1150,1372,'#34424a','#5c7079',13)+rect(88,111,1092,1260,'url(#plate)','#834520',4);
  s+=`<text x="90" y="43" class="board-caption">PLACA DE MONTAGEM / VISTA INTERNA</text>`;
  const duct=(x,y,w,h)=>rect(x,y,w,h,'url(#duct)','#25383f',3)+rect(x,y,w,15,'url(#ductSlots)',null,0)+rect(x,y+h-15,w,15,'url(#ductSlots)',null,0);
  s+=duct(88,81,1092,75)+duct(88,551,1092,78)+duct(88,1080,1092,84)+duct(88,1384,1092,35);
  s+=rect(80,157,52,1218,'url(#duct)','#263c43')+rect(1120,157,60,1218,'url(#duct)','#263c43');
  for(let y=175;y<1370;y+=29){s+=rect(1131,y,20,16,'#24373f',null,1)+rect(89,y,13,16,'#253940',null,1);}
  for(const y of [342,861,1274]){s+=rect(133,y,975,62,'url(#rail)','#6b7971',2);for(let x=148;x<1110;x+=78)s+=rect(x,y+25,43,12,'#465447','#a2aea2',6);s+=circle(1088,y+31,11,'#aabbb1','#4e675e')+`<path d="M1080 ${y+31}h16" stroke="#344a42" stroke-width="3"/>`;}
  for(const d of model.devices.values()){
    const {x,y,w,h,id,type}=d;let body='';
    if(type==='breaker'){
      body+=rect(x,y,w,h,'url(#deviceWhite)','#60766e',5,'class="device-outline" filter="url(#deviceShadow)"');
      const poles=id==='D2'?1:2;
      for(let p=0;p<poles;p++){const px=x+4+p*(w/poles);body+=rect(px,y+23,w/poles-8,185,'#c8d1c4','#879b8f',2);body+=circle(px+(w/poles-8)/2,y+18,12,'#4e655e','#a3b5a3')+circle(px+(w/poles-8)/2,y+h-18,12,'#4e655e','#a3b5a3');body+=rect(px+5,y+143,w/poles-18,35,id==='D2'?'#518cb5':'#384e58','#728a86',3);}
      body+=text(x+10,y+78,id==='D2'?'WEG':'Schneider','#346658',id==='D2'?13:16)+text(x+10,y+99,id==='D2'?'MDW':'Electric','#59746b',10)+text(x+10,y+125,'C10','#52695d',13);
      body+=text(x+w/2,y+h+28,id,'#e4eeed',17,'text-anchor="middle" font-weight="700"');
    }else if(type==='techno'){
      body+=rect(x,y,w,h,'url(#deviceWhite)','#71837a',5,'class="device-outline" filter="url(#deviceShadow)"')+rect(x+8,y+37,w-16,h-77,'#e0e4d6','#8e9e90',3)+rect(x+8,y+37,89,h-77,'#df702c',null,3);
      for(let i=0;i<4;i++){body+=circle(x+22,y+59+i*31,4,'#d0b580','#b97748');body+=text(x+33,y+63+i*31,['Status','Time adj.','Brake','Power adj.'][i],'#fae7be',9);}
      body+=text(x+116,y+109,'Techno Safe','#c77640',19,'font-style="italic" font-weight="700"');
      body+=rect(x+6,y-9,w-12,25,'#375d50','#738d72',3)+rect(x+6,y+h-16,w-12,25,'#375d50','#738d72',3);
      body+=text(x+w/2,y+h+35,'TS · Techno Safe','#e5eeea',16,'text-anchor="middle" font-weight="600"');
    }else if(type==='relay'){
      body+=rect(x-3,y-8,w+6,h+16,'#192d32','#73867f',4,'class="device-outline" filter="url(#deviceShadow)"')+rect(x+6,y+12,w-12,h-45,'#bfc8b590','#a9bbb0',4)+rect(x+16,y+31,w-32,h-84,'#d1d4bf','#9cafa0',1)+text(x+12,y+61,'OMRON','#536d62',8)+text(x+14,y+79,'24VDC','#536d62',8)+text(x+w/2,y+h+34,'RA','#e5eeea',16,'text-anchor="middle"');
    }else if(type==='safety'){
      body+=rect(x-6,y,w+12,h,'#b72f2f','#e9836a',4,'class="device-outline" filter="url(#deviceShadow)"')+rect(x+6,y+12,w-12,h-24,'#202a30','#803d40',2);
      body+=text(x+16,y+31,'OMRON','#e3e9e2',11,'font-weight="600"')+text(x+16,y+59,'G9SE','#e4e8dc',17,'font-weight="600"')+text(x+16,y+79,'201','#e4e8dc',17)+text(x+16,y+96,'24VDC','#b8c9c3',10);
      body+=text(x+w/2,y+h+33,'RS · G9SE','#e6eded',15,'text-anchor="middle"');
    }else if(type==='psu'){
      body+=rect(x,y,w,h,'#283d3e','#6f8780',5,'class="device-outline" filter="url(#deviceShadow)"');for(let n=0;n<15;n++)body+=`<path d="M${x+5+n*7} ${y+103}v240" stroke="#6b82785b" stroke-width="1"/>`;
      body+=rect(x+7,y+5,w-14,44,'#b8c4b0','#839b85',2)+rect(x+7,y+h-49,w-14,44,'#b8c4b0','#839b85',2)+text(x+10,y+78,'OMRON','#e2e8dd',14,'font-weight="650"')+text(x+10,y+97,'S8VK-C12024','#c2d0c5',10)+text(x+13,y+126,'POWER SUPPLY','#c2d0c5',8)+text(x+17,y+166,'24 VCC','#e3ecdf',14)+text(x+14,y+335,'100–240 VAC','#bdcbc2',10)+text(x+w/2,y+h+33,'F · Fonte','#e6eded',15,'text-anchor="middle"');
    }else if(type==='contactor'){
      body+=rect(x,y,w,h,'url(#contactor)','#8ea6a0',4,'class="device-outline" filter="url(#deviceShadow)"')+rect(x+4,y+86,w-8,150,'#6d898b','#93aaa6',2)+rect(x+2,y+7,w-4,55,'#617d7e','#98afa7',2);
      body+=text(x+17,y+163,'Easy TeSys','#e0e9e6',14,'font-weight="650"')+text(x+w-92,y+163,'Schneider','#e0e9e6',13)+text(x+w-77,y+177,'Electric','#e0e9e6',9)+text(x+w-69,y+213,'LAEN22','#b5c9c4',10);
      body+=rect(x+w/2-7,y+180,14,27,'#d8ae37','#91711d',1)+text(x+8,y+286,'NO','#b6cdc9',9)+text(x+w-31,y+286,'A2','#b6cdc9',10);
      body+=rect(x+82,y+146,55,21,'#324f55','#8ba7a3',3)+text(x+w/2,y+161,id,'#fff2ce',16,'text-anchor="middle" font-weight="700"');
      for(let i=0;i<3;i++){body+=circle(x+40+i*68,y+26,14,'#213c44','#a3b7ab')+circle(x+40+i*68,y+h-26,14,'#213c44','#a3b7ab');}
      for(let i=0;i<4;i++){body+=circle(x+27+i*52,y+124,11,'#263b42','#a3b7ab')+circle(x+27+i*52,y+226,11,'#263b42','#a3b7ab');}
    }else if(type==='terminals'){
      const n=id==='B'?26:3;for(let i=0;i<n;i++){const xx=x+i*25;body+=rect(xx,y,24,h,'#b7c3b8','#6f857b',2,'class="device-outline"')+rect(xx+5,y+14,14,13,'#df8a48','#a37853',1)+rect(xx+5,y+h-27,14,13,'#df8a48','#a37853',1)+rect(xx+3,y+39,18,34,'#4a625a','#97ae9b',2);}
      body+=text(x,y-(id==='B'?60:28),id==='B'?'BORNEIRA PRINCIPAL':'U1 · V1 · W1','#ead6b8',13,'letter-spacing="1"');
    }else if(type==='earth'){
      body+=rect(x,y,w,h,'#e0c92d','#aa9224',3,'class="device-outline"')+rect(x+7,y+13,w-14,29,'#4b9b69','#3a7c51',2)+rect(x+7,y+70,w-14,28,'#4b9b69','#3a7c51',2)+text(x+w/2,y-15,'PE','#e1e7c8',12,'text-anchor="middle"');
    }else if(type==='door'){
      body+=rect(x,y,w,h,'#273b40e6','#90a2a3',8,'class="device-outline" stroke-dasharray="7 5"')+text(x+16,y+24,'PORTA · VISTA INTERNA','#a9bdbc',11,'letter-spacing="1"');
      for(const px of [926,1022]){body+=circle(px,815,23,'#8b9988','#e0dac0')+circle(px,815,15,'#cfb960','#91834e')+rect(px-25,825,50,14,'#5c7274','#8fa09a',2);}
      body+=text(926,858,'W022','#c5d5d1',10,'text-anchor="middle"')+text(1022,858,'W021','#c5d5d1',10,'text-anchor="middle"');
      body+=rect(923,883,98,44,'#657579','#a0aaa0',5)+circle(972,899,13,'#a0aaa1','#536869')+text(972,947,'Botão W016/W017','#c3d5d2',11,'text-anchor="middle"');
      for(const px of [892,1009])body+=rect(px,965,46,53,'#89958d','#c6cabb',3)+rect(px+5,980,36,23,'#647d70','#394c43',1)+text(px+23,998,'NC','#d0dacf',10,'text-anchor="middle"');
    }
    s+=`<g class="device" data-device="${id}" tabindex="0" role="button" aria-label="${escapeXML(d.name)}"><title>${escapeXML(d.name)}</title>${body}</g>`;
  }
  s+=`<text x="134" y="1378" fill="#e7d8c3" font-family="Inter,Segoe UI,sans-serif" font-size="11">Bornes identificados pelas tags · numeração física não visível</text>`;
  return s;
}

export function wiresDrawing(model){
  return model.edges.filter(e=>e.kind==='wire').map(e=>{
    const points=model.routePoints(e),d=points.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ');
    const mid=points[Math.floor(points.length/2)];
    const label=e.tag?`<g class="wire-label" transform="translate(${mid[0]-24},${mid[1]-24})">${rect(0,0,49,21,'#fff0d6',null,4)}<text x="24.5" y="15" text-anchor="middle">${escapeXML(e.tag)}</text></g>`:'';
    return `<g class="wire dim" data-edge="${e.id}" data-tag="${escapeXML(e.tag||'__untagged')}" tabindex="-1"><title>${escapeXML(e.tag||'Sem tag')} · ${escapeXML(model.ports.get(e.from).label)} ↔ ${escapeXML(model.ports.get(e.to).label)}</title><path class="wire-halo" d="${d}"/><path class="wire-body" d="${d}" stroke="${e.color}"${e.missing?' stroke-dasharray="9 7"':''}/><path class="wire-hit" d="${d}"/>${label}</g>`;
  }).join('');
}

export function portsDrawing(model){
  return [...model.ports.values()].map(p=>{
    const visible=p.device!=='B'||!p.id.endsWith('.b');
    const label= p.device==='B'?p.pin:p.device==='BM'?p.pin:p.device==='P'?'':p.device==='pending'?'?':p.device.startsWith('D')?p.pin.replace('entrada','E.').replace('saída','S.').replace('esquerda','esq.').replace('direita','dir.'):p.pin;
    const isBottom=p.side==='bottom',labelY=isBottom?16:-11;
    const title=p.label+(p.function?` · ${p.function}`:'');
    const name=p.device.startsWith('C')?p.label:p.device==='RS'?p.label:p.device==='TS'?p.label:p.device==='BM'?p.label:'';
    const textWidth=Math.max(62,name.length*7+15);
    return `<g class="port" data-port="${escapeXML(p.id)}" transform="translate(${p.x},${p.y})"><title>${escapeXML(title)}</title><circle class="port-dot" r="6"/><circle r="14" fill="transparent" style="cursor:pointer"/>${visible&&label?`<text class="port-label" text-anchor="${p.device==='B'?'start':'middle'}" y="${labelY}"${p.device==='B'?' transform="rotate(-65 0 -11)"':''} font-size="${p.device==='B'?9:12}">${escapeXML(label)}</text>`:''}${name?`<g class="port-name" transform="translate(${-textWidth/2},${isBottom?21:-45})"><rect width="${textWidth}" height="23" rx="4"/><text x="${textWidth/2}" y="16" text-anchor="middle">${escapeXML(name)}</text></g>`:''}${p.missing?`<text class="source-missing" x="13" y="4">${p.device==='pending'&&p.id.startsWith('T2')?'Ponta solta':'A confirmar'}</text>`:''}</g>`;
  }).join('');
}
