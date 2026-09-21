// Startup results stay canonical in the thesis repository; all numbers use pointers.
export function appendStartupGraph({registry,json,add,edge,location,claim}) {
  const study=registry.startupBoundaryStudy;if(!study)return;
  const base='openspec/changes/startup-pi-boundary',verification=json(`${base}/artifacts/verification.json`);
  if(!verification)return;
  const group=add({id:'paper:boptest:startup',kind:'experiment',parentId:'paper:boptest',label:'PI 前期輔助｜退出界線與後段保留',status:'EVALUATED',summary:'已知五設備；開發日選界線後鎖定，再測兩個新日期。額外每設備12小時試調，未證明總調整成本更低。',locator:location(study.report,'離線完整報告')});
  const method=add({id:group.id+':method',kind:'method',parentId:group.id,label:'一次性前期補償＋無突跳切回 PI',summary:'共享 ±0.1u 補償上限、每分鐘0.02u變化；連續5分鐘入界、跨越目標或60分鐘到期即退出。狀態轉移不保證後段軌跡等同PI。',locator:location(`${base}/design.md`,'前期輔助方法')});
  const doc=add({id:group.id+':background',kind:'point',parentId:method.id,label:'切換方法背景｜MathWorks 技術文件',status:'DOCUMENTATION_NOT_PAPER',summary:'已知的積分狀態追蹤／無突跳轉移概念，不是新穎性或本方法穩定性證明。',locator:{url:'https://www.mathworks.com/help/simulink/slref/bumpless-control-transfer-between-manual-and-pid-control.html',section:'Bumpless control transfer'}});
  edge(doc.id,method.id,'argues','既有概念背景；非本文效果證據',{sourceLocator:doc.locator,targetLocator:method.locator,status:'BACKGROUND_ONLY'});
  for(const plant of Object.keys(verification.plants)) {
    const pid=group.id+':'+plant,decision=verification.plants[plant];
    const node=add({id:pid,kind:'experiment',parentId:group.id,label:`${plant}｜${decision.selection.band_C===null?'純PI回退':'選定 ±'+decision.selection.band_C+'°C'}`,summary:JSON.stringify(decision,null,2),status:decision.supported_both_dates?'SUPPORTED_WITHIN_SCOPE':'NOT_SUPPORTED',locator:location(`${base}/artifacts/verification.json`,plant,`/plants/${plant}`)});
    edge(node.id,claim.id,'argues',decision.supported_both_dates?'前期與後段門檻在兩日期皆通過；非成本優勢證明':'未確認跨日期前期優勢；保留回退或失敗',{status:node.status,sourceLocator:node.locator,targetLocator:claim.locator});
    const dev=json(`${base}/artifacts/${plant}_development.json`);
    const dataset=add({id:pid+':dataset',kind:'dataset',parentId:pid,label:`BOPTEST v0.9.0｜${dev.config.case}`,summary:`${dev.config.measurement_kind}；沿用2h辨識。21°C設定暖機後改22°C，保留實際起始溫度。自訂FMU runner；非實機。`,locator:location(`${base}/artifacts/${plant}_development.json`,'config','/config')});
    edge(node.id,dataset.id,'uses-data','設備與量測定義');edge(node.id,method.id,'uses-method','共同控制與選界線程序');
    for(const phase of ['development','confirmation']) {
      const file=`${base}/artifacts/${plant}_${phase}.json`,r=json(file);
      const pn=add({id:pid+':'+phase,kind:'experiment',parentId:pid,label:phase==='development'?'開發：三種退出界線':'確認：鎖定政策／回退',summary:phase==='development'?'第8日，每政策3h，共12h試調。':'第35、70日，每次24h；回退重用基準，不計重複試验。',locator:location(file,phase)});
      for(let i=0;i<r.evaluations.length;i++) {
        const a=r.evaluations[i];if(a.method==='auto_pi')continue;
        const j=r.evaluations.findIndex(b=>b.method==='auto_pi'&&b.day===a.day),b=r.evaluations[j];
        const id=pn.id+':'+i;
        const an=add({id,kind:'result',parentId:pn.id,label:`day${a.day}｜${a.reused?'沿用純PI（非改善）':'±'+a.band_C+'°C'}｜退出 ${a.exit_min}min`,summary:JSON.stringify(a,null,2),status:a.reused?'EXACT_REFERENCE_REUSE':'EVALUATED',locator:location(file,`evaluations[${i}]`,`/evaluations/${i}`)});
        const bn=add({id:id+':baseline',kind:'result',parentId:pn.id,label:`day${a.day}｜同條件PI參照`,summary:JSON.stringify(b,null,2),locator:location(file,`evaluations[${j}]`,`/evaluations/${j}`)});
        for(const window of ['early','late'])for(const metric of ['mae_C','rmse_C','max_abs_error_C','requested_TV_u']) {
          const x=a.windows[window][metric],y=b.windows[window][metric],outcome=x<y?'BETTER':x>y?'WORSE':'TIE';
          edge(an.id,bn.id,'compares',`${window==='early'?'前1h':'後段'} ${metric}｜${outcome}`,{metric,outcome,ours:x,baseline:y,context:{target:r.config.measurement_kind,dataset:r.config.case,budget_h:2,phase,window,day:a.day,band_C:a.band_C,reused:a.reused,scope:'Known-device pipeline confirmation; no unseen-plant claim'},sourceLocator:location(file,`${window}.${metric}`,`/evaluations/${i}/windows/${window}/${metric}`),targetLocator:location(file,`${window}.${metric}`,`/evaluations/${j}/windows/${window}/${metric}`)});
        }
      }
    }
  }
}
