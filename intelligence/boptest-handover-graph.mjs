// Startup results stay canonical in the thesis repository; all numbers use pointers.
export function appendHandoverGraph({registry,json,add,edge,location,claim}) {
  const study=registry.handoverAblationStudy;if(!study)return;
  const base='openspec/changes/startup-handover-ablation',verification=json(`${base}/artifacts/verification.json`);
  if(!verification)return;
  const group=add({id:'paper:boptest:handover',kind:'experiment',parentId:'paper:boptest',label:'PI 輔助時間 × 交接方式｜2×2比較',status:'EVALUATED',summary:'已知五設備；開發日選界線後鎖定，再測兩個新日期。每設備新增12小時候選試調，另引用既有3小時基準，未證明總調整成本更低。',locator:location(study.report,'離線完整報告')});
  const method=add({id:group.id+':method',kind:'method',parentId:group.id,label:'15/55分鐘 × 逐步撤除/轉入積分',summary:'共享誤差輔助與普通PI核心；到15/55分鐘或跨越目標時交接。taper逐步撤除，retain轉入積分；交接前軌跡相同以隔離因素。轉入積分後作用仍可持續，非15分鐘後完全無影響。',locator:location(`${base}/design.md`,'前期輔助方法')});
  for(const plant of Object.keys(verification.plants)) {
    const pid=group.id+':'+plant,decision=verification.plants[plant];
    const node=add({id:pid,kind:'experiment',parentId:group.id,label:`${plant}｜${decision.selection.policy===null?'純PI回退':'選定 '+decision.selection.policy}`,summary:JSON.stringify(decision,null,2),status:decision.supported_both_dates?'SUPPORTED_WITHIN_SCOPE':'NOT_SUPPORTED',locator:location(`${base}/artifacts/verification.json`,plant,`/plants/${plant}`)});
    edge(node.id,claim.id,'argues',decision.supported_both_dates?'前期與後段門檻在兩日期皆通過；非成本優勢證明':'未確認跨日期前期優勢；保留回退或失敗',{status:node.status,sourceLocator:node.locator,targetLocator:claim.locator});
    const dev=json(`${base}/artifacts/${plant}_development.json`);
    const dataset=add({id:pid+':dataset',kind:'dataset',parentId:pid,label:`BOPTEST v0.9.0｜${dev.config.case}`,summary:`${dev.config.measurement_kind}；沿用2h辨識。21°C設定暖機後改22°C，保留實際起始溫度。自訂FMU runner；非實機。`,locator:location(`${base}/artifacts/${plant}_development.json`,'config','/config')});
    edge(node.id,dataset.id,'uses-data','設備與量測定義');edge(node.id,method.id,'uses-method','共同控制與選界線程序');
    const factorFile=`${base}/artifacts/${plant}_development.json`;
    add({id:pid+':factorial',kind:'result',parentId:pid,label:'兩因素分離比較｜固定時間／固定交接方式',summary:JSON.stringify(decision.factorial_contrasts,null,2),status:'DEVELOPMENT_ONLY',locator:location(`${base}/artifacts/verification.json`,plant+' factorial contrasts',`/plants/${plant}/factorial_contrasts`)});
    for(const c of decision.factorial_contrasts)for(const window of ['early','late'])for(const metric of ['mae_C','rmse_C','max_abs_error_C','requested_TV_u']) {
      const ai=c.a_index,bi=c.b_index,x=dev.evaluations[ai].windows[window][metric],y=dev.evaluations[bi].windows[window][metric];
      edge(`${pid}:development:${ai}`,`${pid}:development:${bi}`,'compares',`${c.label}｜${window} ${metric}`,{metric,ours:x,baseline:y,outcome:x<y?'BETTER':x>y?'WORSE':'TIE',context:{target:dev.config.measurement_kind,dataset:dev.config.case,budget_h:2,phase:'factorial_development',window,factor:c.label,a_policy:c.a_policy,b_policy:c.b_policy,day:8,scope:'Fixed-factor contrasts on known deterministic FMU; not population inference'},sourceLocator:location(factorFile,c.a_policy,`/evaluations/${ai}/windows/${window}/${metric}`),targetLocator:location(factorFile,c.b_policy,`/evaluations/${bi}/windows/${window}/${metric}`)});
    }
    for(const phase of ['development','confirmation']) {
      const file=`${base}/artifacts/${plant}_${phase}.json`,r=json(file);
      const pn=add({id:pid+':'+phase,kind:'experiment',parentId:pid,label:phase==='development'?'開發：四種時間／交接組合':'確認：鎖定政策／回退',summary:phase==='development'?'第8日，新候選4×3h；基準引用前輪相同條件軌跡。':'第48、83日，每次24h；回退重用基準，不計重複試验。',locator:location(file,phase)});
      for(let i=0;i<r.evaluations.length;i++) {
        const a=r.evaluations[i];if(a.method==='auto_pi')continue;
        const j=r.evaluations.findIndex(b=>b.method==='auto_pi'&&b.day===a.day),b=r.evaluations[j];
        const id=pn.id+':'+i;
        const an=add({id,kind:'result',parentId:pn.id,label:`day${a.day}｜${a.reused?'沿用純PI（非改善）':a.policy}｜退出 ${a.exit_min}min`,summary:JSON.stringify(a,null,2),status:a.reused?'EXACT_REFERENCE_REUSE':'EVALUATED',locator:location(file,`evaluations[${i}]`,`/evaluations/${i}`)});
        const bn=add({id:id+':baseline',kind:'result',parentId:pn.id,label:`day${a.day}｜同條件PI參照`,summary:JSON.stringify(b,null,2),locator:location(file,`evaluations[${j}]`,`/evaluations/${j}`)});
        for(const window of ['early','late'])for(const metric of ['mae_C','rmse_C','max_abs_error_C','requested_TV_u']) {
          const x=a.windows[window][metric],y=b.windows[window][metric],outcome=x<y?'BETTER':x>y?'WORSE':'TIE';
          edge(an.id,bn.id,'compares',`${window==='early'?'前1h':'後段'} ${metric}｜${outcome}`,{metric,outcome,ours:x,baseline:y,context:{target:r.config.measurement_kind,dataset:r.config.case,budget_h:2,phase,window,day:a.day,policy:a.policy,reused:a.reused,scope:'Known-device pipeline confirmation; no unseen-plant claim'},sourceLocator:location(file,`${window}.${metric}`,`/evaluations/${i}/windows/${window}/${metric}`),targetLocator:location(file,`${window}.${metric}`,`/evaluations/${j}/windows/${window}/${metric}`)});
        }
      }
    }
  }
}
