// Startup results stay canonical in the thesis repository; all numbers use pointers.
export function appendPredictiveStartupGraph({registry,json,add,edge,location,claim}) {
  const study=registry.predictiveStartupStudy;if(!study)return;
  const base='openspec/changes/predictive-startup-boundary',verification=json(`${base}/artifacts/verification.json`);
  if(!verification)return;
  const group=add({id:'paper:boptest:predictive-startup',kind:'experiment',parentId:'paper:boptest',label:'PI 趨勢預估退出｜積分接手研究',status:'EVALUATED',summary:'已知五設備；開發日選界線後鎖定，再測兩個新日期。每設備新增9小時試調，另引用既有3小時基準，未證明總調整成本更低。',locator:location(study.report,'離線完整報告')});
  const method=add({id:group.id+':method',kind:'method',parentId:group.id,label:'趨勢預估撤離＋獨立 PI 積分接手',summary:'共享0.1u補償上限、每分鐘0.02u變化；預估3/10/30分鐘接近目標、PI積分接手或55分鐘上限後撤離。補償不注入PI積分；60分鐘後只有PI，軌跡不保證等同基準。',locator:location(`${base}/design.md`,'前期輔助方法')});
  for(const plant of Object.keys(verification.plants)) {
    const pid=group.id+':'+plant,decision=verification.plants[plant];
    const node=add({id:pid,kind:'experiment',parentId:group.id,label:`${plant}｜${decision.selection.horizon_min===null?'純PI回退':'預估 '+decision.selection.horizon_min+'min'}`,summary:JSON.stringify(decision,null,2),status:decision.supported_both_dates?'SUPPORTED_WITHIN_SCOPE':'NOT_SUPPORTED',locator:location(`${base}/artifacts/verification.json`,plant,`/plants/${plant}`)});
    edge(node.id,claim.id,'argues',decision.supported_both_dates?'前期與後段門檻在兩日期皆通過；非成本優勢證明':'未確認跨日期前期優勢；保留回退或失敗',{status:node.status,sourceLocator:node.locator,targetLocator:claim.locator});
    const dev=json(`${base}/artifacts/${plant}_development.json`);
    const dataset=add({id:pid+':dataset',kind:'dataset',parentId:pid,label:`BOPTEST v0.9.0｜${dev.config.case}`,summary:`${dev.config.measurement_kind}；沿用2h辨識。21°C設定暖機後改22°C，保留實際起始溫度。自訂FMU runner；非實機。`,locator:location(`${base}/artifacts/${plant}_development.json`,'config','/config')});
    edge(node.id,dataset.id,'uses-data','設備與量測定義');edge(node.id,method.id,'uses-method','共同控制與選界線程序');
    for(const phase of ['development','confirmation']) {
      const file=`${base}/artifacts/${plant}_${phase}.json`,r=json(file);
      const pn=add({id:pid+':'+phase,kind:'experiment',parentId:pid,label:phase==='development'?'開發：三種預估時間':'確認：鎖定政策／回退',summary:phase==='development'?'第8日，新候選3×3h；基準引用前輪相同條件軌跡。':'第42、77日，每次24h；回退重用基準，不計重複試验。',locator:location(file,phase)});
      for(let i=0;i<r.evaluations.length;i++) {
        const a=r.evaluations[i];if(a.method==='auto_pi')continue;
        const j=r.evaluations.findIndex(b=>b.method==='auto_pi'&&b.day===a.day),b=r.evaluations[j];
        const id=pn.id+':'+i;
        const an=add({id,kind:'result',parentId:pn.id,label:`day${a.day}｜${a.reused?'沿用純PI（非改善）':'預估'+a.horizon_min+'min'}｜退出 ${a.exit_min}min`,summary:JSON.stringify(a,null,2),status:a.reused?'EXACT_REFERENCE_REUSE':'EVALUATED',locator:location(file,`evaluations[${i}]`,`/evaluations/${i}`)});
        const bn=add({id:id+':baseline',kind:'result',parentId:pn.id,label:`day${a.day}｜同條件PI參照`,summary:JSON.stringify(b,null,2),locator:location(file,`evaluations[${j}]`,`/evaluations/${j}`)});
        for(const window of ['early','late'])for(const metric of ['mae_C','rmse_C','max_abs_error_C','requested_TV_u']) {
          const x=a.windows[window][metric],y=b.windows[window][metric],outcome=x<y?'BETTER':x>y?'WORSE':'TIE';
          edge(an.id,bn.id,'compares',`${window==='early'?'前1h':'後段'} ${metric}｜${outcome}`,{metric,outcome,ours:x,baseline:y,context:{target:r.config.measurement_kind,dataset:r.config.case,budget_h:2,phase,window,day:a.day,horizon_min:a.horizon_min,reused:a.reused,scope:'Known-device pipeline confirmation; no unseen-plant claim'},sourceLocator:location(file,`${window}.${metric}`,`/evaluations/${i}/windows/${window}/${metric}`),targetLocator:location(file,`${window}.${metric}`,`/evaluations/${j}/windows/${window}/${metric}`)});
        }
      }
    }
  }
}
