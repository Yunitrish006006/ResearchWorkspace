const NS = "http://www.w3.org/2000/svg";

const nodes = [
  {id:"topic",type:"topic",x:500,y:70,label:"Single-room spatial digital twin",title:"Single-room sparse-sensing spatial digital twin",desc:"以單一房間的稀疏感測，估計 temperature、relative humidity 與 illuminance 三因子空間場。"},
  {id:"claim-primary",type:"claim",x:270,y:175,label:"Interpretable primary estimator",title:"Interpretable model remains primary",desc:"Variable-specific nominal model 是 primary estimator；data-driven model 僅修正 residual。"},
  {id:"claim-boundary",type:"claim",x:730,y:175,label:"Bounded evidence claims",title:"Evidence boundaries remain explicit",desc:"Synthetic full-field、real target-point、public task-aligned benchmark、intervention evidence 不互相替代。"},
  {id:"method-physics",type:"method",x:170,y:300,label:"Physics nominal model",title:"Variable-specific nominal models",desc:"溫度、濕度、照度分別使用對應的物理啟發模型。"},
  {id:"method-idw",type:"method",x:360,y:300,label:"IDW baseline",title:"Sensor IDW baseline",desc:"在相同 target 與 metric 下作為空間估測 baseline。"},
  {id:"method-hybrid",type:"method",x:545,y:300,label:"Hybrid residual",title:"Hybrid residual correction",desc:"以 nominal prediction + residual correction 形成 hybrid estimate。"},
  {id:"evidence-sim",type:"evidence",x:120,y:445,label:"E1 / E2",title:"Controlled field evidence",desc:"E1 full-field reconstruction 與 E2 IDW baseline 比較；屬 controlled simulation。"},
  {id:"evidence-real",type:"evidence",x:360,y:445,label:"E7",title:"Real-bedroom target-point evidence",desc:"7-day / 28-snapshot pillow reference point evidence；不是 dense full-room ground truth。"},
  {id:"evidence-public",type:"evidence",x:610,y:445,label:"E9",title:"Public task-aligned benchmark",desc:"SML2010 / CU-BEMS 在相容時序任務上比較 persistence、linear regression 與 mapped readout。"},
  {id:"review-e8",type:"review",x:850,y:445,label:"E8 pending",title:"Intervention verification pending",desc:"Before/after intervention 尚未完成，因此不能宣稱控制動作具有真實 causal efficacy。"}
];

const edges = [
  ["topic","claim-primary"],["topic","claim-boundary"],
  ["claim-primary","method-physics"],["claim-primary","method-idw"],["claim-primary","method-hybrid"],
  ["method-physics","evidence-sim"],["method-idw","evidence-sim"],["method-hybrid","evidence-real"],
  ["claim-boundary","evidence-real"],["claim-boundary","evidence-public"],["claim-boundary","review-e8"],
  ["method-hybrid","evidence-public"]
];

const colors = {topic:"#66d4ff",claim:"#ffcf70",method:"#a99bff",evidence:"#62e3a7",review:"#ff8299"};
const svg = document.getElementById("researchGraph");
const inspectorTitle = document.getElementById("nodeTitle");
const inspectorType = document.getElementById("nodeType");
const inspectorDescription = document.getElementById("nodeDescription");
const inspectorLinks = document.getElementById("nodeLinks");

function byId(id){ return nodes.find(function(n){ return n.id === id; }); }

edges.forEach(function(pair){
  const a = byId(pair[0]), b = byId(pair[1]);
  const line = document.createElementNS(NS,"line");
  line.setAttribute("x1",a.x); line.setAttribute("y1",a.y);
  line.setAttribute("x2",b.x); line.setAttribute("y2",b.y);
  line.setAttribute("class","edge");
  line.dataset.a = a.id; line.dataset.b = b.id;
  svg.appendChild(line);
});

nodes.forEach(function(n){
  const g = document.createElementNS(NS,"g");
  g.setAttribute("class","node");
  g.setAttribute("transform","translate("+n.x+" "+n.y+")");
  g.dataset.id=n.id;

  const c = document.createElementNS(NS,"circle");
  c.setAttribute("r", n.type === "topic" ? 29 : 22);
  c.setAttribute("fill", colors[n.type]+"18");
  c.setAttribute("stroke", colors[n.type]);

  const t = document.createElementNS(NS,"text");
  t.setAttribute("text-anchor","middle");
  t.setAttribute("y", n.type === "topic" ? 48 : 40);
  t.textContent=n.label;

  g.appendChild(c); g.appendChild(t);
  g.addEventListener("click",function(){ selectNode(n.id); });
  svg.appendChild(g);
});

function selectNode(id){
  const n=byId(id);
  document.querySelectorAll(".node").forEach(function(el){ el.classList.toggle("selected", el.dataset.id===id); });
  document.querySelectorAll(".edge").forEach(function(el){ el.classList.toggle("active", el.dataset.a===id || el.dataset.b===id); });
  inspectorTitle.textContent=n.title;
  inspectorType.textContent=n.type.toUpperCase();
  inspectorType.style.color=colors[n.type];
  inspectorDescription.textContent=n.desc;
  const related=edges.filter(function(e){ return e[0]===id || e[1]===id; }).map(function(e){ return byId(e[0]===id?e[1]:e[0]); });
  inspectorLinks.innerHTML="";
  related.forEach(function(r){
    const a=document.createElement("a");
    a.href="#graph"; a.textContent="→ "+r.title;
    a.addEventListener("click",function(ev){ ev.preventDefault(); selectNode(r.id); });
    inspectorLinks.appendChild(a);
  });
}
selectNode("topic");

const evidence = [
  ["E1","Canonical full-field reconstruction","REPRODUCIBLE","ok","controlled simulation"],
  ["E2","IDW baseline comparison","REPRODUCIBLE","ok","controlled simulation"],
  ["E3","Ablation & reproducibility","REPRODUCIBLE","ok","robustness / ablation"],
  ["E4","Appliance impact-learning checks","BOUNDED","bound","controlled / recorded checks"],
  ["E5","Window-condition matrix","REPRODUCIBLE","ok","boundary sensitivity"],
  ["E6","Hybrid residual robustness","REPRODUCIBLE","ok","held-out / LOO evidence"],
  ["E7","Real-bedroom sparse calibration","REPRODUCIBLE","ok","real target-point"],
  ["E8","Before / after intervention","PENDING","todo","causal evidence not yet complete"],
  ["E9","Public task-aligned benchmark","CONDITIONAL","bound","SML2010 / CU-BEMS"]
];

const grid=document.getElementById("evidenceGrid");
evidence.forEach(function(item){
  const card=document.createElement("article");
  card.className="evidence-card";
  card.innerHTML="<header><span class='eid'>"+item[0]+"</span><span class='status "+item[3]+"'>"+item[2]+"</span></header>"+
    "<h3>"+item[1]+"</h3><p>"+item[4]+"</p><small>Claim strength follows available evidence.</small>";
  grid.appendChild(card);
});
