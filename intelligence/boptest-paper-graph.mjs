import {appendHandoverGraph} from './boptest-handover-graph.mjs';
import {appendPredictiveStartupGraph} from './boptest-predictive-startup-graph.mjs';
import {appendStartupGraph} from './boptest-startup-graph.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Canonical numbers live in the thesis checkout. This adapter only derives typed nodes.
export function appendBoptestPaperGraph({root,nodes,relations,warnings}) {
  const read=p=>fs.existsSync(path.join(root,p))?fs.readFileSync(path.join(root,p),'utf8'):'';
  const json=p=>{const s=read(p);return s?JSON.parse(s):null;};
  const registryPath='docs/research/boptest_graph_sources.json', registry=json(registryPath);
  if(!registry)return;
  const idHash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,12);
  const add=n=>{nodes.push(n);return n;};
  const edge=(from,to,type,label,extra={})=>relations.push({id:`paper-edge:boptest:${idHash([from,to,type,label].join('|'))}`,from,to,type,label,...extra});
  const location=(file,section,jsonPointer)=>({path:file,section,...(jsonPointer?{jsonPointer}:{})});
  const ext=add({id:'paper:boptest',kind:'point',parentId:'paper:main',label:'控溫延伸研究｜未採納主論文',summary:'少資料辨識、調整成本與閉迴路控溫。全部為模擬研究；圖中保留失敗、退步與停用補償，不等於主論文已驗證控制。',status:'UNADOPTED_RESEARCH_EXTENSION',locator:location(registryPath,'控溫研究來源註冊')});
  const claim=add({id:'paper:boptest:claim',kind:'point',parentId:ext.id,label:'研究主張｜以較少調整成本達到同等或較佳控溫（待確認）',summary:'資料量、試調時間、暖機、計算成本需分列。尚無人工工時或跨領域實機驗證。',status:'NOT_CONFIRMED',locator:location('openspec/changes/model-consistent-compensation/research.md','MCC-001 研究問題')});
  const literature=[];
  for(const p of registry.literature||[]) {
    const paper=add({id:`paper:boptest:literature:${p.id}`,kind:'paper',label:p.title,summary:`${p.authors.join(', ')}\n相關文獻；摘要已核對，正文與公式未逐項核對。`,status:p.verified,locator:{url:p.url,section:'arXiv abstract record'}});
    const point=add({id:paper.id+':point',kind:'point',parentId:paper.id,label:p.point,summary:p.summary,status:p.verified,locator:{url:p.url,section:p.sourceSection}});
    literature.push(point);
  }
  for(const round of registry.rounds) {
    const base=`openspec/changes/${round.change}`, verification=json(`${base}/artifacts/verification.json`);
    const group=add({id:`paper:boptest:round:${round.id}`,kind:'experiment',parentId:ext.id,label:round.label,summary:`${round.scope}\n報告：${round.report}`,status:verification?'EVALUATED':'IN_PROGRESS',locator:location(`${base}/evidence.md`,round.label),reportLocator:location(round.report,'離線教授報告')});
    const method=add({id:group.id+':method',kind:'method',parentId:group.id,label:round.methodLabel,summary:read(`${base}/design.md`),locator:location(`${base}/design.md`,'方法設計')});
    const baseline=add({id:group.id+':baseline',kind:'method',parentId:group.id,label:'auto-PI（依本輪資料／試調預算）',summary:'只與同一輪、同設備、同日期、同資料預算比較；不同輪的 q 選擇流程不能混成同條件結果。',locator:location(`${base}/protocol.md`,'基準與成本')});
    edge(group.id,method.id,'uses-method','本輪使用方法');
    if(round.id==='consistent')for(const target of literature) {
      const sourceLocator={...method.locator,path:`${base}/research.md`,line:4,section:'MCC-001 相關文獻與適用邊界'};
      edge(method.id,target.id,'cites','方法背景引用｜摘要已核對，非本文公式重現',{sourceLocator,targetLocator:target.locator});
      edge(target.id,method.id,'argues','相關設計問題依據；不構成本方法穩定性或新穎性證明',{sourceLocator:target.locator,targetLocator:method.locator,status:'BACKGROUND_ONLY'});
    }
    for(const plant of round.plants) {
      const file=`${base}/artifacts/${plant}.json`,r=json(file);
      if(!r){warnings.push(`BOPTEST 結果尚未提供：${file}`);continue;}
      const pid=group.id+':'+plant;
      const plantNode=add({id:pid,kind:'experiment',parentId:group.id,label:`${plant}｜${r.config.case}`,summary:`${r.config.measurement_kind}\n${round.scope}\n執行狀態 ${r.status}`,status:r.status,locator:location(file,'設備研究結果')});
      const dataset=add({id:pid+':dataset',kind:'dataset',parentId:pid,label:`BOPTEST v0.9.0｜${r.config.case}`,summary:JSON.stringify({measurement:r.config.measurement_kind,calibration:r.calibration_trace||r.identification?.trace,config:r.config,scope:'官方 FMU、自訂 FMPy runner；非實機，未證明 REST/KPI 等價'},null,2),locator:location(`outputs/vendor/boptest-v0.9.0/testcases/${r.config.case}/doc/index.html`,'官方設備文件')});
      edge(plantNode.id,dataset.id,'uses-data','設備模型、天氣與校正資料');
      const banks=r.banks||r.fits||{};
      for(const [h,b] of Object.entries(banks)) {
        const fit=add({id:pid+':fit:'+h,kind:'result',parentId:pid,label:`${h}h 辨識｜${b.status}${b.selected?` · ${b.selected.order}階／延遲${b.selected.delay_steps}min`:''}`,summary:JSON.stringify(b,null,2),status:b.status,locator:location(file,`${r.banks?'banks':'fits'}.${h}`,`/${r.banks?'banks':'fits'}/${h}`)});
        if(b.status!=='FITTED')edge(fit.id,claim.id,'argues','適用性限制｜辨識拒絕；不填零、不算控制成功',{status:'NEGATIVE_EVIDENCE',sourceLocator:fit.locator,targetLocator:claim.locator});
      }
      const evals=r.evaluations||[];
      for(let i=0;i<evals.length;i++) {
        const ours=evals[i];if(ours.method!==round.method)continue;
        const j=evals.findIndex(e=>e.method==='auto_pi'&&e.day===ours.day&&e.budget_h===ours.budget_h);if(j<0)continue;
        const other=evals[j],key=`${ours.budget_h}h:day${ours.day}`,cid=pid+':'+key;
        const verdict=ours.metrics.mae_C<other.metrics.mae_C?'較佳':ours.metrics.mae_C>other.metrics.mae_C?'較差':'持平';
        const cas=add({id:cid,kind:'experiment',parentId:pid,label:`${key}｜MAE ${verdict}`,summary:JSON.stringify({scope:round.scope,identification_h:ours.budget_h,adaptation_h:ours.active_adaptation_h??ours.adaptation_exposure_h??ours.budget_h+4,q:ours.q,baseline_q:other.q,day:ours.day},null,2),locator:location(file,`evaluations[${i}]`,`/evaluations/${i}`)});
        edge(cas.id,method.id,'uses-method','本方法');edge(cas.id,baseline.id,'uses-method','同條件基準');edge(cas.id,dataset.id,'uses-data','同設備與日期');
        const a=add({id:cid+':ours',kind:'result',parentId:cid,label:round.methodLabel,summary:JSON.stringify(ours,null,2),locator:location(file,`evaluations[${i}]`,`/evaluations/${i}`)});
        const b=add({id:cid+':baseline',kind:'result',parentId:cid,label:'auto-PI',summary:JSON.stringify(other,null,2),locator:location(file,`evaluations[${j}]`,`/evaluations/${j}`)});
        for(const [metric,unit] of [['mae_C','°C'],['rmse_C','°C'],['max_abs_error_C','°C'],['requested_TV_u','normalized u']]) {
          const x=ours.metrics[metric],y=other.metrics[metric];if(!Number.isFinite(x)||!Number.isFinite(y))continue;
          const outcome=x<y?'BETTER':x>y?'WORSE':'TIE';
          edge(a.id,b.id,'compares',`${{BETTER:'較佳',WORSE:'較差',TIE:'持平'}[outcome]}｜${metric} ${x.toFixed(5)} vs ${y.toFixed(5)} ${unit}`,{metric,outcome,ours:x,baseline:y,context:{target:r.config.measurement_kind,dataset:r.config.case,day:ours.day,budget_h:ours.budget_h,scope:round.scope,unit},sourceLocator:location(file,`evaluations[${i}].metrics.${metric}`,`/evaluations/${i}/metrics/${metric}`),targetLocator:location(file,`evaluations[${j}].metrics.${metric}`,`/evaluations/${j}/metrics/${metric}`)});
        }
      }
      const decision=verification?.plants?.[plant];
      if(decision)for(const d of decision.decisions||[]) {
        const gate=add({id:pid+':gate:'+d.budget_h,kind:'result',parentId:pid,label:`${d.budget_h}h 整體門檻｜${d.gate?'通過':'未通過'}`,summary:JSON.stringify(d,null,2),status:d.gate?'SUPPORTED_WITHIN_SCOPE':'NOT_SUPPORTED',locator:location(`${base}/artifacts/verification.json`,`${plant} / ${d.budget_h}h`)});
        edge(gate.id,claim.id,'argues',d.gate?'有限條件支持｜不等於人工成本或泛化已驗證':'未支持本輪優勢｜持平、退步或辨識拒絕',{status:gate.status,sourceLocator:gate.locator,targetLocator:claim.locator});
      }
      const report=add({id:pid+':report',kind:'point',parentId:pid,label:'開啟離線報告與研究紀錄',summary:`${round.report}\n${base}/evidence.md`,locator:location(round.report,'教授報告')});edge(plantNode.id,report.id,'argues','完整結果及適用邊界');
    }
  }
  if(registry.deviceGroupAnalysis) {
    const data=json(registry.deviceGroupAnalysis);
    if(data) {
      const title={BOTH_IMPROVE:'兩天皆改善',BOTH_WORSEN:'兩天皆退步',MIXED:'混合結果',EXACT_FALLBACK:'停用持平',REJECTED:'辨識拒絕'};
      const parent=add({id:'paper:boptest:device-groups',kind:'experiment',parentId:ext.id,label:'裝置群體分析｜事後觀察，非因果',summary:'分析補償碰限幅、模型時間尺度、短期反應和辨識品質；保留同設備資料量反轉。不能依此直接新增控制分支。',status:'DESCRIPTIVE_ONLY',locator:location('docs/reports/boptest_device_groups_2026-09-08_zh.html','裝置群體分析')});
      for(const [key,label] of Object.entries(title)) {
        const group=add({id:parent.id+':'+key,kind:'point',parentId:parent.id,label,summary:'依兩個日期的原始 MAE 增益符號分組；不等同原實驗複合門檻。',status:'DESCRIPTIVE_ONLY',locator:location(registry.deviceGroupAnalysis,key)});
        for(const [i,row] of data.groups.entries())if(row.group===key) {
          const feature=add({id:group.id+':'+row.plant+':'+row.budget_h,kind:'result',parentId:group.id,label:`${row.plant} / ${row.budget_h}h｜${label}`,summary:JSON.stringify(row,null,2),status:'DESCRIPTIVE_ONLY',locator:location(registry.deviceGroupAnalysis,`groups[${i}]`,`/groups/${i}`)});
          edge(feature.id,`paper:boptest:round:consistent:${row.plant}`,'argues','共現特徵與反例｜不是因果或已驗證分類規則',{status:'DESCRIPTIVE_ONLY',sourceLocator:feature.locator,targetLocator:location('openspec/changes/model-consistent-compensation/artifacts/'+row.plant+'.json','原實驗結果')});
        }
      }
    }
  }

  appendStartupGraph({registry,json,add,edge,location,claim});
  appendPredictiveStartupGraph({registry,json,add,edge,location,claim});
  appendHandoverGraph({registry,json,add,edge,location,claim});

}
