const D=window.PERFIL_DATA;
let mode='tienda', current=null, charts={}, mixMonth='YTD';

const byId=id=>document.getElementById(id);
const months=D.months;
const monthShort=months.map(m=>m.slice(0,3));
const dirByCeco=Object.fromEntries(D.directory.map(d=>[String(d.ceco),d]));
const pctMetrics=new Set(['Rolling RY','Rolling RY AA','Labor','Labor PPTO','VMT%','VMT AA','OMT%','OMT AA','Conexion','Conexion AA','Calidad de la Bebida','Calidad de Bebida AA','Food Attach','Food Attach AA','SR','% SR AA','Venta Delivery','Delivery AA','Costo %','Costo % PPTO','EBITDA','EBITDA PPTO']);
const goodInverse=new Set(['Labor','Costo %','DT Time','adt_diff']);

function valid(v){return v!==null&&v!==undefined&&!Number.isNaN(Number(v));}
function avg(a){const x=a.filter(valid).map(Number);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;}
function sum(a){const x=a.filter(valid).map(Number);return x.length?x.reduce((s,v)=>s+v,0):null;}
function fmt(v,type='num'){
  if(!valid(v))return '—';
  v=Number(v);
  if(type==='money')return '$'+(Math.abs(v)>=1000000?(v/1000000).toFixed(1)+'M':Math.abs(v)>=1000?(v/1000).toFixed(0)+'K':v.toFixed(0));
  if(type==='moneyM')return '$'+(v/1000000).toFixed(1)+'M';
  if(type==='moneyK')return '$'+(v/1000).toFixed(0)+'K';
  if(type==='pct')return (v*100).toFixed(1)+'%';
  if(type==='pp')return (v*100>=0?'+':'')+(v*100).toFixed(1);
  if(type==='sec')return sec(v);
  return Math.abs(v)%1?Number(v).toFixed(1):String(Math.round(v));
}
function sec(v){
  if(!valid(v))return '—';
  let s=Math.round(Number(v));
  if(v>0 && v<1)s=Math.round(Number(v)*86400);
  let h=Math.floor(s/3600), m=Math.floor((s%3600)/60), r=s%60;
  if(h>0)return `${h}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}
function cls(v,inverse=false){if(!valid(v))return'neutral';return (inverse?Number(v)<=0:Number(v)>=0)?'pos':'neg';}
function cleanLabel(s){return String(s||'').replace(/_/g,' ').trim();}
function destroy(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function makeChart(id,config){destroy(id);const ctx=byId(id);if(ctx)charts[id]=new Chart(ctx,config);}
function chartOpt(type){
  return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{position:'bottom',labels:{boxWidth:18,usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw,type)}`}}},
    scales:{y:{beginAtZero:false,ticks:{callback:v=>type==='pct'?(v*100).toFixed(0)+'%':type==='money'||type==='moneyM'||type==='moneyK'?'$'+(v/1000000).toFixed(1)+'M':type==='sec'?sec(v):v}},x:{grid:{display:false}}}
  };
}
function getScope(){
  if(mode==='tienda'){const d=D.directory.find(x=>x.tienda===current);return d?[String(d.ceco)]:[];}
  if(mode==='dm')return D.directory.filter(x=>x.dm===current).map(x=>String(x.ceco));
  return D.directory.filter(x=>x.rd===current || x.region===current).map(x=>String(x.ceco));
}
function getRows(source,cecos){const set=new Set(cecos.map(String));return source.filter(r=>set.has(String(r.ceco)));}
function groupByMonth(source,cecos,metric,agg='avg'){
  const rows=getRows(source,cecos), out=[];
  for(let m=1;m<=12;m++){
    const vals=rows.filter(r=>r.m===m).map(r=>r[metric]);
    out.push(agg==='sum'?sum(vals):avg(vals));
  }
  return out;
}
function latest(vals){for(let i=vals.length-1;i>=0;i--)if(valid(vals[i]))return vals[i];return null;}
function ytd(vals,agg='avg'){return agg==='sum'?sum(vals):avg(vals);}
function monthlyDiff(base,compare,fn='minus'){
  return base.map((v,i)=>valid(v)&&valid(compare[i])?(fn==='aaMinus'?compare[i]-v:v-compare[i]):null);
}
function makeCard(cfg){
  const id='c'+Math.random().toString(36).slice(2);
  const cecos=getScope();
  let vals=groupByMonth(cfg.source,cecos,cfg.metric,cfg.agg||'avg');
  let type=cfg.type||(pctMetrics.has(cfg.metric)?'pct':'num');
  let k=cfg.ytd===false?latest(vals):ytd(vals,cfg.agg||'avg');
  let diffs=null, diffY=null;
  if(cfg.diffMetric){
    const comp=groupByMonth(cfg.source,cecos,cfg.diffMetric,cfg.diffAgg||cfg.agg||'avg');
    diffs=monthlyDiff(vals,comp,cfg.diffMode);
    diffY=avg(diffs);
  }else if(cfg.diffSourceMetric){
    diffs=groupByMonth(cfg.diffSource||cfg.source,cecos,cfg.diffSourceMetric,cfg.diffAgg||'avg');
    diffY=avg(diffs);
  }
  const diffType=cfg.diffType||type;
  const chips=(diffs||[]).map((d,i)=>valid(d)?`<span class="pill ${cls(d,cfg.inverseDiff)}">${monthShort[i]} ${fmt(d,diffType)}</span>`:'').join('');
  const diffHTML=diffs?`<div class="pill-row">${chips}</div>`:'';
  const kpiNote=cfg.ytd===false?'Último dato':'YTD';
  const html=`<article class="card">
    <div class="card-head">
      <div><h3>${cfg.title}</h3><div class="note">${cfg.subtitle||'Tendencia mensual + YTD'}</div></div>
      <div><div class="kpi">${fmt(k,type)}</div><div class="note">${kpiNote}</div></div>
    </div>
    <div class="canvas-wrap"><canvas id="${id}"></canvas></div>
    ${valid(diffY)?`<span class="pill ${cls(diffY,cfg.inverseDiff)}">Dif YTD ${fmt(diffY,diffType)}</span>`:''}
    ${diffHTML}
  </article>`;
  setTimeout(()=>{
    const datasets=[{label:cfg.title,data:vals,type:cfg.bar?'bar':'line',tension:.35,fill:false,borderWidth:3,pointRadius:3}];
    if(diffs)datasets.push({label:'Dif',data:diffs,type:'bar',borderWidth:0,yAxisID:'y',backgroundColor:'rgba(0,117,74,.15)'});
    makeChart(id,{type:cfg.bar?'bar':'line',data:{labels:monthShort,datasets},options:chartOpt(type)});
  },0);
  return html;
}
function compareCard(title,source,a,b,opt={}){
  const id='c'+Math.random().toString(36).slice(2), cecos=getScope();
  const va=groupByMonth(source,cecos,a,opt.agg||'avg'), vb=groupByMonth(source,cecos,b,opt.agg||'avg');
  const d=monthlyDiff(va,vb);
  const type=opt.type||'pct', y=ytd(va,opt.agg||'avg'), yb=ytd(vb,opt.agg||'avg'), yd=valid(y)&&valid(yb)?y-yb:null;
  const chips=d.map((x,i)=>valid(x)?`<span class="pill ${cls(x,opt.inverseDiff)}">${monthShort[i]} ${fmt(x,type)}</span>`:'').join('');
  const html=`<article class="card">
    <div class="card-head"><div><h3>${title}</h3><div class="note">Real vs Presupuesto</div></div><div><div class="kpi">${fmt(y,type)}</div><div class="note">Ppto ${fmt(yb,type)}</div></div></div>
    <div class="canvas-wrap"><canvas id="${id}"></canvas></div>
    ${valid(yd)?`<span class="pill ${cls(yd,opt.inverseDiff)}">Dif ${fmt(yd,type)}</span>`:''}<div class="pill-row">${chips}</div>
  </article>`;
  setTimeout(()=>makeChart(id,{type:'line',data:{labels:monthShort,datasets:[{label:'Real',data:va,tension:.35,borderWidth:3},{label:'Ppto',data:vb,tension:.35,borderWidth:2},{label:'Dif',data:d,type:'bar',backgroundColor:'rgba(0,117,74,.15)'}]},options:chartOpt(type)}),0);
  return html;
}
function setMode(m){mode=m;['Tienda','DM','RD'].forEach(x=>byId('tab'+x).classList.toggle('active',m===x.toLowerCase()));byId('selector').placeholder=m==='tienda'?'Buscar tienda...':m==='dm'?'Buscar DM...':'Buscar RD / Región...';fillOptions();applySelection();}
function fillOptions(){
  let opts=[];
  if(mode==='tienda')opts=[...new Set(D.directory.map(x=>x.tienda).filter(Boolean))].sort();
  if(mode==='dm')opts=[...new Set(D.directory.map(x=>x.dm).filter(Boolean))].sort();
  if(mode==='rd')opts=[...new Set(D.directory.map(x=>x.rd).filter(Boolean))].sort();
  byId('options').innerHTML=opts.map(x=>`<option value="${x}"></option>`).join('');
  if(!opts.includes(byId('selector').value))byId('selector').value=opts[0]||'';
  fillMonthFilter();
}
function fillMonthFilter(){
  const sel=byId('mixMonth'); if(!sel)return;
  sel.innerHTML=`<option value="YTD">YTD</option>`+months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
  sel.value=mixMonth;
}
function applySelection(){current=byId('selector').value;if(current)render();}
function period(){
  const cecos=getScope(), all=[...getRows(D.pcs,cecos),...getRows(D.venta,cecos),...getRows(D.adt,cecos),...getRows(D.ticket,cecos)].map(x=>x.m).filter(Boolean);
  let a=Math.min(...all),b=Math.max(...all);
  byId('periodo').textContent=(isFinite(a)?months[a-1]:'Mes inicio')+' a '+(isFinite(b)?months[b-1]:'Último dato')+' · YTD';
}
function baseItem(k,v){return `<div class="base-item"><small>${k}</small><b>${v||'—'}</b></div>`;}
function countMap(arr){const o={};arr.filter(Boolean).forEach(x=>o[x]=(o[x]||0)+1);return o;}
function renderTypeBars(rows){
  if(mode==='tienda'){byId('typeVisualCard').classList.add('hidden');return;}
  byId('typeVisualCard').classList.remove('hidden');
  const counts=countMap(rows.map(x=>x.tipo5));
  const max=Math.max(...Object.values(counts),1);
  byId('typeBars').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>
    `<div class="type-row"><span>${k}</span><div class="type-bar"><span style="width:${(v/max*100).toFixed(0)}%"></span></div><b>${v}</b></div>`).join('');
}
function renderBase(){
  const cecos=getScope();
  const rows=D.directory.filter(x=>cecos.includes(String(x.ceco)));
  const d=rows[0]||{};
  if(mode==='tienda'){
    byId('baseGrid').innerHTML=[
      ['Apertura',d.apertura],['Tipo tienda 5',d.tipo5],['Gerente',d.gerente],['Tier',d.tier],['Seating',d.seating],['Seats',d.seats_num]
    ].map(baseItem).join('');
  }else{
    const types=countMap(rows.map(x=>x.tipo5)), seating=countMap(rows.map(x=>x.seating));
    byId('baseGrid').innerHTML=[
      ['# tiendas',rows.length],['Tipo principal',Object.entries(types).sort((a,b)=>b[1]-a[1])[0]?.join(' · ')],['Seating principal',Object.entries(seating).sort((a,b)=>b[1]-a[1])[0]?.join(' · ')],['Región',mode==='rd'?current:[...new Set(rows.map(x=>x.region))].join(', ')],['RD',mode==='dm'?[...new Set(rows.map(x=>x.rd))].join(', '):current],['Abiertas',rows.filter(x=>/abierta/i.test(x.estatus)).length]
    ].map(baseItem).join('');
  }
  renderTypeBars(rows);
}
function renderMixOnly(){mixMonth=byId('mixMonth').value;renderMix();}
function renderMix(){
  const cecos=getScope(), set=new Set(cecos);
  const rows=D.mix.filter(x=>set.has(String(x.ceco)) && (mixMonth==='YTD'||x.m===Number(mixMonth)));
  const order={}, cat={};
  rows.forEach(r=>{
    Object.entries(r.order||{}).forEach(([k,v])=>order[k]=(order[k]||0)+v);
    Object.entries(r.category||{}).forEach(([k,v])=>cat[k]=(cat[k]||0)+v);
  });
  // average shares across store-month rows for clean portfolio view
  const n=Math.max(rows.length,1);
  Object.keys(order).forEach(k=>order[k]/=n); Object.keys(cat).forEach(k=>cat[k]/=n);
  iconCards('orderIconCards',order,'order');
  iconCards('categoryIconCards',cat,'cat');
  dough('chartOrder',order); dough('chartCategory',cat);
}
function iconFor(k,type){
  const s=k.toLowerCase();
  if(type==='order'){
    if(s.includes('drive'))return'🚗'; if(s.includes('pick'))return'🛍️'; if(s.includes('delivery'))return'🛵'; if(s.includes('lobby'))return'🏬';
  }else{
    if(s.includes('café')||s.includes('cafe')||s.includes('filtrado'))return'☕'; if(s.includes('espresso'))return'☕'; if(s.includes('food'))return'🥐'; if(s.includes('cbs'))return'🥤';
  }
  return'✨';
}
function iconCards(id,obj,type){
  const entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,4);
  byId(id).innerHTML=entries.map(([k,v])=>`<div class="icon-card"><span class="emoji">${iconFor(k,type)}</span><div><b>${cleanLabel(k)}</b><small>${fmt(v,'pct')}</small></div></div>`).join('')||'<div class="note">Sin data disponible</div>';
}
function dough(id,obj){
  const labels=Object.keys(obj), vals=Object.values(obj);
  makeChart(id,{type:'doughnut',data:{labels,datasets:[{data:vals,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12}},tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.raw,'pct')}`}}}}});
}
function renderSections(){
  byId('partnerGrid').innerHTML=
    makeCard({title:'Rolling RY',source:D.pcs,metric:'Rolling RY',ytd:false,diffMetric:'Rolling RY AA',diffMode:'aaMinus',diffType:'pp',subtitle:'12M atrás · objetivo <30%'})+
    makeCard({title:'IPLH',source:D.pcs,metric:'IPLH'})+
    makeCard({title:'TPLH',source:D.pcs,metric:'TPLH'})+
    makeCard({title:'Labor %',source:D.pcs,metric:'Labor',diffMetric:'Labor PPTO',diffType:'pp',inverseDiff:true})+
    makeCard({title:'ICA Score',source:D.pcs,metric:'ICA Score',type:'num',bar:true,subtitle:'Auditorías disponibles'});
  byId('customerGrid').innerHTML=
    makeCard({title:'Venta Mes',source:D.venta,metric:'venta_mes',type:'moneyM',agg:'sum',bar:true,subtitle:'Suma mensual en millones'})+
    makeCard({title:'AWS',source:D.venta,metric:'aws',type:'moneyM',agg:'sum',bar:true,subtitle:'Average Weekly Sales'})+
    makeCard({title:'ADT',source:D.adt,metric:'adt',type:'num',diffSourceMetric:'adt_diff',diffType:'num',subtitle:'ADT real + dif vs AA'})+
    makeCard({title:'Ticket Promedio',source:D.ticket,metric:'ticket',type:'money',diffSourceMetric:'ticket_diff',diffSource:D.ticket,diffType:'pp',subtitle:'Ticket + dif vs AA'})+
    makeCard({title:'VMT',source:D.pcs,metric:'VMT%'})+
    makeCard({title:'OMT',source:D.pcs,metric:'OMT%'})+
    makeCard({title:'Conexión',source:D.pcs,metric:'Conexion',diffMetric:'Conexion AA',diffType:'pp'})+
    makeCard({title:'Calidad Bebida',source:D.pcs,metric:'Calidad de la Bebida',diffMetric:'Calidad de Bebida AA',diffType:'pp'})+
    makeCard({title:'Food Attach',source:D.pcs,metric:'Food Attach',diffMetric:'Food Attach AA',diffType:'pp'})+
    makeCard({title:'Segundas Ventas',source:D.pcs,metric:'Segundas Ventas',type:'num'})+
    makeCard({title:'SR',source:D.pcs,metric:'SR',diffMetric:'% SR AA',diffType:'pp'});
  byId('businessGrid').innerHTML=
    makeCard({title:'Venta Delivery',source:D.pcs,metric:'Venta Delivery',diffMetric:'Delivery AA',diffType:'pp'})+
    compareCard('Costo %',D.pcs,'Costo %','Costo % PPTO',{inverseDiff:true,type:'pct'})+
    compareCard('EBITDA',D.pcs,'EBITDA','EBITDA PPTO',{type:'pct'})+
    makeCard({title:'DT Time',source:D.pcs,metric:'DT Time',type:'sec',diffMetric:'Tiempo DT AA',diffType:'sec',inverseDiff:true,subtitle:'Formato hh:mm · menor es mejor'});
}
function render(){
  Object.keys(charts).forEach(destroy);
  const cecos=getScope(), rows=D.directory.filter(x=>cecos.includes(String(x.ceco)));
  const d=rows[0]||{};
  period();
  byId('profileType').textContent=mode==='tienda'?'Base Tienda':mode==='dm'?'Base DM':'Base RD';
  byId('profileName').textContent=current;
  byId('profileSub').textContent=mode==='tienda'?`${d.dm||'DM no disponible'} · ${d.tipo5||''}`:`${rows.length} tiendas · Perfil ejecutivo`;
  renderBase();
  renderMix();
  renderSections();
  restorePhoto();
}
function loadPhoto(e){
  const f=e.target.files[0]; if(!f||!current)return;
  const r=new FileReader();
  r.onload=()=>{localStorage.setItem('perfil_photo_'+mode+'_'+current,r.result);byId('photoPreview').src=r.result;};
  r.readAsDataURL(f);
}
function resetPhoto(){if(current)localStorage.removeItem('perfil_photo_'+mode+'_'+current);byId('photoPreview').removeAttribute('src');}
function restorePhoto(){const v=current&&localStorage.getItem('perfil_photo_'+mode+'_'+current);if(v)byId('photoPreview').src=v;else byId('photoPreview').removeAttribute('src');}
fillOptions();applySelection();