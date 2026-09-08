import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { thesisRoot } from './source-index.mjs';
import { appendBoptestPaperGraph } from './boptest-paper-graph.mjs';

const sourcePath = 'docs/thesis/thesis_draft_zh.md';
const hash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
const outcome = (a, b) => a < b ? 'BETTER' : a > b ? 'WORSE' : 'TIE';
const verdict = { BETTER: '較佳', WORSE: '較差', TIE: '持平', NOT_COMPARABLE: '不可直接比較' };

// This is a derived view: paragraphs, bibliography and results remain owned by school.
export function buildPaperGraph({ root = thesisRoot() } = {}) {
  const manifestPath=path.join(root,'docs/research/published_graph_evidence.json');
  const published=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')).files:{};
  const resolveSource=p=>published[p]?.path||p;
  const read = p => fs.existsSync(path.join(root, resolveSource(p))) ? fs.readFileSync(path.join(root, resolveSource(p)), 'utf8') : '';
  const json = p => { const s = read(p); return s ? JSON.parse(s) : null; };
  const text = read(sourcePath);
  if (!text) return { schemaVersion: 1, nodes: [], relations: [], warnings: ['主稿來源缺失'] };
  const nodes = [], relations = [], warnings = [];
  const bib = read('docs/papers/ieee/references.bib').split(/(?=@[a-z]+\{)/i).map(entry => ({title:entry.match(/title\s*=\s*\{([^\n]+)\}/i)?.[1],doi:entry.match(/doi\s*=\s*\{([^}]+)\}/i)?.[1]}));
  const add = n => { nodes.push(n); return n; };
  const edge = (from, to, type, label, extra = {}) => relations.push({ id: `paper-edge:${hash([from,to,type,label].join('|'))}`, from, to, type, label, ...extra });
  const locator = (line, section) => ({ path: sourcePath, line, section });
  const main = add({ id: 'paper:main', kind: 'paper', label: '主論文｜單房間稀疏感測空間數位孿生', summary: '室內三因子估計；延伸至機箱虛擬感測。展開查看章節、論點、演算法、資料集及實驗比較。', locator: locator(7, '主論文'), status: 'DRAFT' });
  const lines = text.split(/\r?\n/), refs = new Map(), sections = [];
  for (let i=0; i<lines.length; i++) {
    const m = lines[i].match(/^- \[(\d+)\] (.+)$/);
    if (!m) continue;
    const ref = m[2], doi = ref.match(/DOI:\s*(\S+)/)?.[1];
    const title = bib.find(b=>b.doi && b.doi===doi)?.title;
    const kind = /\[Dataset\]|GitHub dataset|Data from the AAU/.test(ref) ? 'dataset' : /Documentation/.test(ref) ? 'reference' : 'paper';
    refs.set(m[1], add({ id: `paper:ref-${m[1]}`, kind, parentId: kind === 'paper' ? null : main.id, label: `[${m[1]}] ${title || ref.split(/, (?:Energy|Building|Scientific|IEEE|Proceedings|International|DOI)/)[0]}`, summary: ref, locator: { ...locator(i+1, `參考文獻 [${m[1]}]`), url: doi ? `https://doi.org/${doi}` : ref.match(/https?:\/\/\S+/)?.[0] }, status: 'BIBLIOGRAPHY' }));
  }
  for (let i=0; i<lines.length; i++) {
    const m = lines[i].match(/^(#{2,6}) (\d+\.\d+(?:\.\d+)* .+|E11[A-Z] .+)$/);
    if (!m) continue;
    const title = m[2], number = title.split(' ')[0];
    const parentNumber = number.includes('.') ? number.slice(0,number.lastIndexOf('.')) : '';
    const parent = sections.find(s => s.number === parentNumber);
    const s = add({ id: `paper:section:${number}`, kind: 'point', parentId: parent?.id || main.id, label: title, summary: '', locator: locator(i+1,title), number, start: i, end: lines.length });
    if (sections.length) sections.at(-1).end = i;
    sections.push(s);
  }
  const methods = [ ['IDW', /\bIDW\b/i], ['Hybrid residual', /hybrid residual/i], ['Pure / vanilla RNN', /pure RNN|vanilla RNN/i], ['GRU', /\bGRU\b/], ['LSTM', /\bLSTM\b/], ['Kalman filter', /Kalman/i], ['Persistence', /persistence/i], ['Linear regression / readout', /linear regression|linear readout|線性回歸/i], ['Frozen ridge', /frozen.*ridge|凍結.*ridge|load-aware ridge/i], ['Huber calibration', /Huber/], ['物理啟發 reduced-order model', /reduced-order|物理啟發/], ['Trilinear correction', /trilinear|三線性/], ['Bootstrap', /bootstrap/i] ];
  const datasets = [['SML2010', /SML2010/i, '14'], ['CU-BEMS', /CU-BEMS/i, '12'], ['AAU Server Room', /AAU/, '36'], ['BMC server', /BMC/, '35'], ['受控模擬', /受控|synthetic|標準情境/], ['臥室快照', /臥室|bedroom|pillow/i]];
  for (const s of sections) {
    const body = lines.slice(s.start+1,s.end).join('\n').split('\n# ')[0];
    s.summary = body.slice(0,2400).trim();
    for (const [name,re] of methods) if (re.test(body)) {
      const n=add({ id:`${s.id}:method:${hash(name)}`,kind:'method',parentId:s.id,label:name,summary:`主稿此節使用或討論 ${name}；是否勝出請查看同任務結果。`,locator:s.locator });
      edge(s.id,n.id,'uses-method','使用／討論演算法');
    }
    if (s.number.startsWith('5.') || s.number.startsWith('E11')) for (const [name,re,refId] of datasets) if (re.test(body)) {
      const n=add({ id:`${s.id}:dataset:${hash(name)}`,kind:'dataset',parentId:s.id,label:name,summary:'此實驗節提及的資料來源；具體 split、target 與證據範圍見章節及結果。',locator:s.locator });
      edge(s.id,n.id,'uses-data','實驗資料來源');
      if (refs.has(refId)) edge(n.id,refs.get(refId).id,'cites','資料集來源');
    }
    for (let i=s.start+1; i<s.end; i++) {
      if (/^# 參考文獻/.test(lines[i])) break;
      if (/^\s*[-|]/.test(lines[i]) && /^- \[\d+\]/.test(lines[i])) continue;
      const ids = [...lines[i].matchAll(/\[(\d+)\]/g)].map(m=>m[1]).filter(id=>refs.has(id));
      if (!ids.length) continue;
      const point=add({id:`${s.id}:citation:${hash(lines[i])}`,kind:'point',parentId:s.id,label:`引用論點｜${lines[i].slice(0,65)}`,summary:lines[i],locator:locator(i+1,s.label)});
      for (const id of new Set(ids)) {
        const ref=refs.get(id), targetId=`${ref.id}:point:${hash(s.id+lines[i])}`;
        add({id:targetId,kind:'point',parentId:ref.id,label:`對應主稿 ${s.number} 的引用內容`,summary:`主稿如何引用：${lines[i]}\n外部原文章節、頁碼與段落尚未核對；此節點代表主稿引用的對應概念，不是已查證的原文引句。`,locator:{url:ref.locator.url,section:'原文定位待核對'},status:'SOURCE_LOCATION_PENDING'});
        edge(point.id,targetId,'cites',`引用｜主稿 ${s.label} L${i+1} → [${id}] 對應概念（原文定位待核對）`,{sourceLocator:point.locator,targetLocator:{url:ref.locator.url,section:'原文定位待核對'}});
        if (/依據|參考|啟發|支持/.test(lines[i])) edge(targetId,point.id,'argues','論證依據｜主稿的文獻判讀；原文定位待核對',{status:'SOURCE_LOCATION_PENDING'});
        if (/比[較對]|差異/.test(lines[i])) edge(point.id,targetId,'compares','文獻／方法比較｜不可直接判定較佳或較差',{outcome:'NOT_COMPARABLE'});
      }
    }
  }
  const sectionFor = number => sections.find(s=>s.number===number) || main;
  const resultGroup = (id,title,section,file,summary) => add({id,kind:'experiment',parentId:sectionFor(section).id,label:title,summary,locator:{path:file,section:title}});
  const compare = (group, key, name, baseline, values, other, meta={}) => {
    meta={...meta,unit:/temperature|temp|CPU/i.test(meta.target||'')?'°C':/humidity/i.test(meta.target||'')?'%RH':/illuminance/i.test(meta.target||'')?'lux':'依結果來源'};
    const metricVerdicts=['mae','rmse','p95'].filter(k=>Number.isFinite(values[k])&&Number.isFinite(other[k])).map(k=>`${k.toUpperCase()} ${verdict[outcome(values[k],other[k])]}`).join(' · ');
    const parent=group;
    group=add({id:`${parent.id}:case:${hash(key)}`,kind:'experiment',parentId:parent.id,label:`${meta.target||key} · ${meta.horizon_minutes ? meta.horizon_minutes+' min · ' : ''}${name} vs ${baseline}${meta.run ? ' · '+meta.run : ''}｜${metricVerdicts}`,summary:JSON.stringify(meta,null,2),locator:parent.locator});
    for(const method of [name,baseline]) {
      const id=`${group.id}:algorithm:${hash(method)}`;
      if(!nodes.some(n=>n.id===id)) {add({id,kind:'method',parentId:group.id,label:method,summary:'此比較實際評估的方法',locator:group.locator});edge(group.id,id,'uses-method','實驗使用演算法');}
    }
    if(meta.dataset) {
      const id=`${group.id}:dataset`;
      if(!nodes.some(n=>n.id===id)) {add({id,kind:'dataset',parentId:group.id,label:meta.dataset,summary:JSON.stringify(meta,null,2),locator:group.locator});edge(group.id,id,'uses-data','實際評估資料集');}
    }
    const a=add({id:`${group.id}:${key}:ours`,kind:'result',parentId:group.id,label:name,summary:JSON.stringify({metrics:values,...meta},null,2),locator:group.locator});
    const b=add({id:`${group.id}:${key}:baseline`,kind:'result',parentId:group.id,label:baseline,summary:JSON.stringify({metrics:other,...meta},null,2),locator:group.locator});
    for (const metric of ['mae','rmse','p95']) if (Number.isFinite(values[metric]) && Number.isFinite(other[metric])) {
      const status=outcome(values[metric],other[metric]);
      edge(a.id,b.id,'compares',`${verdict[status]}｜${metric.toUpperCase()}（越低越好）${values[metric].toFixed(4)} vs ${other[metric].toFixed(4)} ${meta.unit}｜${meta.target||key}`,{outcome:status,metric,ours:values[metric],baseline:other[metric],context:meta,sourceLocator:group.locator,targetLocator:group.locator});
    }
    edge(a.id,sectionFor(meta.section || '5.9').id,'argues','實驗證據；僅限所列資料、target、split 與指標');
  };
  for (const [dataset,section,file] of [['SML2010','5.9.2','sml2010_hybrid_twin_comparison.json'],['CU-BEMS','5.9','cu_bems_hybrid_twin_comparison.json']]) {
    const p=`outputs/data/public_benchmarks/${file}`, d=json(p);
    if (!d) { warnings.push(`缺少實驗結果：${p}`); continue; }
    const group=resultGroup(`paper:experiment:${dataset}`,`${dataset} 同任務逐項比較`,section,p,'比較為本地同資料 baseline，並非重現資料集作者的模型。');
    for (const task of d.tasks||[]) for (const [target,metrics] of Object.entries(task.targets||{})) {
      const ours=metrics[d.mapped_model_name]; if (!ours) continue;
      for (const baseline of ['persistence','linear_regression']) if (metrics[baseline]) compare(group,`${task.task_id}:${task.horizon_minutes}:${target}:${baseline}`,d.mapped_model_name,baseline,ours,metrics[baseline],{dataset,target,horizon_minutes:task.horizon_minutes,task:task.task_id,train:task.train_samples,test:task.test_samples,section});
    }
  }
  for (const [file,section,primary] of [
    ['rnn_sml2010_comparison.json','5.9.3.2','vanilla_rnn'],
    ['gru_lstm_sml2010_comparison.json','5.9.3.2','gru'],
    ['oh2024_inspired_sml2010_comparison.json','5.9.3','hybrid_digital_twin_readout'],
  ]) {
    const p=`outputs/data/public_benchmarks/${file}`,d=json(p);
    if (!d) {warnings.push(`缺少實驗結果：${p}`);continue;}
    const group=resultGroup(`paper:experiment:${file}`,d.study_id||file,section,p,JSON.stringify({protocol:d.protocol,boundary:d.claim_boundary,fidelity:d.method_fidelity},null,2));
    for(const c of d.cases||[]) {
      const metrics=c.metrics||{},names=Object.keys(metrics).filter(k=>Number.isFinite(metrics[k]?.mae));
      const selected=names.includes(primary)?primary:names.find(k=>/gru/i.test(k));
      if(!selected)continue;
      for(const baseline of names.filter(k=>k!==selected)) compare(group,`${c.target}:${c.horizon_minutes}:${selected}:${baseline}`,selected,baseline,metrics[selected],metrics[baseline],{dataset:d.dataset,target:c.target,horizon_minutes:c.horizon_minutes,train:c.train_samples,test:c.test_samples,section,boundary:d.claim_boundary});
    }
    if(file.startsWith('oh2024')) edge(group.id,'paper:ref-26','compares','Oh 2024 方法啟發移植；不是原文模型／原始資料重現，不可直接判定勝過原論文',{outcome:'NOT_COMPARABLE',sourceLocator:group.locator,targetLocator:{section:'原文定位待核對',url:refs.get('26')?.locator.url}});
  }
  const ep='openspec/changes/confirm-bmc-temporal-transfer-e15/artifacts/bmc_confirmation_e15_result.json';
  const e15=json(ep)||json('outputs/data/enclosure/bmc_confirmation_e15_result.json');
  if (e15) {
    const group=resultGroup('paper:experiment:E15','E15 凍結確認與逐 run 結果','5.9.3.7',read(ep)?ep:'outputs/data/enclosure/bmc_confirmation_e15_result.json','同一伺服器 CPU 目標；不支持桌機機箱、NTC、跨伺服器、完整空間場或控制效益。');
    for (const [key,row] of [['aggregate',e15.aggregate],...(e15.per_run||[]).map(r=>[r.filename,r])]) {
      const convert=m=>({mae:m.mae_c,rmse:m.rmse_c,p95:m.p95_c});
      compare(group,key,'Frozen load-aware ridge','Inlet + frozen offset',convert(row.ridge),convert(row.baseline),{dataset:'BMC',target:'max(Cpu1_Temp, Cpu2_Temp)',run:key,section:'5.9.3.7',hypothesis:e15.hypothesis_decision});
    }
  }
  for(const [file,section,preferred] of [
    ['aau_spatial_baseline.json','5.9.3.5','nearest_neighbor'],
    ['aau_local_idw_confirmation.json','5.9.3.6','local_idw_k3_p2'],
    ['aau_role_conditioned_confirmation.json','E11D','role_conditioned'],
    ['aau_hierarchical_development.json','E11E','role_local_k5_p2'],
    ['aau_tail_safe_development.json','E11G',''],
    ['aau_commissioning_development.json','E11H','commissioning_sensor_map_v1'],
    ['aau_commissioning_confirmation_e11f.json','E11H','commissioning_sensor_map_v1'],
  ]) {
    const p=`outputs/data/enclosure/${file}`,d=json(p);
    if(!d){warnings.push(`缺少實驗結果：${p}`);continue;}
    const ev=d.evaluation||{},metrics=ev.metrics||ev.macro_metrics||ev;
    const names=Object.keys(metrics).filter(k=>Number.isFinite(metrics[k]?.mae_c));
    const primary=names.includes(preferred)?preferred:names.find(k=>!k.includes('baseline')&&!k.includes('global'));
    const group=resultGroup(`paper:experiment:${file}`,d.experiment||d.experiment_id||file,section,p,JSON.stringify({boundary:d.interpretation_limit,decision:ev.confirmation_decision||ev.development_decision||d.decision,bootstrap:ev.bootstrap||d.bootstrap,gates:ev.gates,calendar_overlap:ev.calendar_overlap},null,2));
    if(!primary){warnings.push(`結果已索引但比較格式待映射：${p}`);continue;}
    const convert=m=>({mae:m.mae_c,rmse:m.rmse_c,p95:m.p95_absolute_error_c});
    for(const baseline of names.filter(k=>k!==primary && (names.length<5 || /baseline|global|local_idw/.test(k)))) compare(group,baseline,primary,baseline,convert(metrics[primary]),convert(metrics[baseline]),{dataset:'AAU Server Room v4',target:'temperature',section,split:file,boundary:d.interpretation_limit});
    for(const [sensor,m] of Object.entries(ev.per_sensor_mae||{})) if(Number.isFinite(m.model_mae_c)&&Number.isFinite(m.baseline_mae_c)) compare(group,sensor,primary,'local IDW baseline',{mae:m.model_mae_c},{mae:m.baseline_mae_c},{dataset:'AAU Server Room v4',target:`temperature / ${sensor}`,section,split:file});
  }
  const nextPath='outputs/data/public_benchmarks/next_day_temperature_improvement.json',next=json(nextPath);
  if(next){
    const group=resultGroup('paper:experiment:next-day','次日預測：預先選定方法的負向結果','5.9.3.1',nextPath,JSON.stringify({protocol:next.protocol,decisions:next.decisions,boundary:next.claim_boundary},null,2));
    for(const c of next.cases||[]) {
      const m=c.final_test_candidate_metrics||{},a=m[c.selected_candidate]?.test_metrics,b=m.seasonal_persistence?.test_metrics;
      if(a&&b)compare(group,c.target,c.selected_candidate,'seasonal_persistence',a,b,{dataset:'SML2010',target:c.target,horizon_minutes:c.horizon_minutes,section:'5.9.3.1',train:c.train_samples,test:c.test_samples});
    }
  }
  // Include every verification metric, including negative/missing/document-only records.
  const report=json('outputs/data/thesis_result_verification_report.json');
  const groups=new Map();
  for (const r of report?.results||[]) {
    const category=r.category||'other';
    if (!groups.has(category)) groups.set(category,resultGroup(`paper:metrics:${category}`,`核對數值｜${category}`,'5.9','outputs/data/thesis_result_verification_report.json','數值核對通過不等於方法勝出；比較結論需相同任務的比較邊。'));
    add({id:`paper:metric:${r.result_name}`,kind:'result',parentId:groups.get(category).id,label:`${r.result_name} = ${r.computed_value ?? '缺失'}`,summary:JSON.stringify(r,null,2),status:r.status,locator:{path:r.evidence_file,section:r.result_name}});
  }
  if (!report) warnings.push('本地數值核對報告缺失；不推定實驗通過');
  appendBoptestPaperGraph({root,nodes,relations,warnings});
  // Explicit containment plus endpoint provenance; collapsed edges are projected by viewers.
  for (const n of nodes) if (n.parentId) edge(n.parentId,n.id,'contains','展開下一層');
  // Keep GitHub endpoint links on the published, hash-audited result snapshots.
  for(const n of nodes)if(n.locator?.path)n.locator.path=resolveSource(n.locator.path);
  for(const e of relations)for(const key of ['sourceLocator','targetLocator'])if(e[key]?.path)e[key].path=resolveSource(e[key].path);
  const uniqueNodes=[...new Map(nodes.map(n=>[n.id,n])).values()];
  return {schemaVersion:1,mainPaperId:main.id,sourceSha256:crypto.createHash('sha256').update(text).digest('hex'),nodes:uniqueNodes,relations:[...new Map(relations.map(r=>[r.id,r])).values()],warnings,coverage:{references:refs.size,sections:sections.length,externalLocationsPending:uniqueNodes.filter(n=>n.status==='SOURCE_LOCATION_PENDING').length}};
}
