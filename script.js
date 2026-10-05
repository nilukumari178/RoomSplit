const STORAGE_KEY="roomsplit_v1";
const defaultData={
  roommates:["A","B","C"],
  commonCategories:["Rent","Electricity","Wi-Fi","Groceries"],
  expenses:[]
};
let data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")||defaultData;
let currentMonth=new Date();
currentMonth.setDate(1);

const $=id=>document.getElementById(id);
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const monthKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`};
const monthLabel=d=>d.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
const currentKey=()=>`${currentMonth.getFullYear()}-${String(currentMonth.getMonth()+1).padStart(2,"0")}`;
const save=()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
const toast=msg=>{const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)};

function monthExpenses(){return data.expenses.filter(e=>monthKey(e.date)===currentKey())}
function participantNames(e){return e.type==="common"?data.roommates:e.sharedBy}
function calculate(){
  const people=Object.fromEntries(data.roommates.map(p=>[p,{paid:0,share:0,balance:0}]));
  monthExpenses().forEach(e=>{
    if(!people[e.paidBy]) people[e.paidBy]={paid:0,share:0,balance:0};
    people[e.paidBy].paid+=Number(e.amount);
    const ps=participantNames(e);
    const each=Number(e.amount)/Math.max(ps.length,1);
    ps.forEach(p=>{if(!people[p]) people[p]={paid:0,share:0,balance:0};people[p].share+=each});
  });
  Object.values(people).forEach(p=>p.balance=p.paid-p.share);
  return people;
}
function settlement(){
  const p=calculate();
  let creditors=Object.entries(p).filter(([,x])=>x.balance>0.005).map(([name,x])=>({name,amount:x.balance})).sort((a,b)=>b.amount-a.amount);
  let debtors=Object.entries(p).filter(([,x])=>x.balance<-0.005).map(([name,x])=>({name,amount:-x.balance})).sort((a,b)=>b.amount-a.amount);
  const out=[];
  let i=0,j=0;
  while(i<debtors.length&&j<creditors.length){
    const amount=Math.min(debtors[i].amount,creditors[j].amount);
    if(amount>0.005) out.push({from:debtors[i].name,to:creditors[j].name,amount});
    debtors[i].amount-=amount;creditors[j].amount-=amount;
    if(debtors[i].amount<0.005)i++;
    if(creditors[j].amount<0.005)j++;
  }
  return out;
}
function renderDashboard(){
  $("monthTitle").textContent=monthLabel(currentMonth);
  const ex=monthExpenses();
  $("totalMonth").textContent=money(ex.reduce((s,e)=>s+Number(e.amount),0));
  $("expenseCount").textContent=`${ex.length} expense${ex.length===1?"":"s"}`;
  const p=calculate();
  $("balanceCards").innerHTML=data.roommates.map(n=>{
    const x=p[n]||{paid:0,share:0,balance:0};
    return `<div class="balance-card"><div><div class="name">${esc(n)}</div><div class="muted">Paid ${money(x.paid)}</div></div><div class="balance ${x.balance>=0?"positive":"negative"}">${x.balance>=0?"+":"−"}${money(Math.abs(x.balance)).replace("₹","₹")}</div></div>`
  }).join("");
  const s=settlement();
  $("settlementList").innerHTML=s.length?s.map(x=>`<div class="settlement-row"><span><b>${esc(x.from)}</b> pays <b>${esc(x.to)}</b></span><span class="settlement-amount">${money(x.amount)}</span></div>`).join(""):`<p class="hint">Everyone is settled up for this month.</p>`;
  const recent=[...ex].sort((a,b)=>new Date(b.date)-new Date(a.date)||b.created-a.created).slice(0,5);
  $("recentExpenses").innerHTML=recent.length?recent.map(expenseHTML).join(""):`<div class="card"><p class="hint">No expenses for this month yet.</p></div>`;
}
function expenseHTML(e){
  return `<div class="expense-row"><div class="expense-main"><div class="expense-title">${esc(e.description)}</div><div class="expense-meta">${esc(e.category)} · ${esc(e.paidBy)} paid · Shared by ${participantNames(e).map(esc).join(", ")}</div><div class="expense-meta">${new Date(e.date+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})} · ${e.type==="common"?"Common":"Shared"}</div></div><div class="expense-amount">${money(e.amount)}<br><button class="delete-btn" onclick="deleteExpense('${e.id}')">Delete</button></div></div>`;
}
function renderExpenses(){
  const q=$("expenseSearch").value.toLowerCase();
  const cat=$("categoryFilter").value;
  const ex=monthExpenses().filter(e=>(e.description+" "+e.category+" "+e.paidBy).toLowerCase().includes(q)&&(cat==="all"||e.category===cat)).sort((a,b)=>new Date(b.date)-new Date(a.date)||b.created-a.created);
  $("expenseList").innerHTML=ex.length?ex.map(expenseHTML).join(""):`<div class="card"><p class="hint">No matching expenses.</p></div>`;
  const cats=[...new Set(monthExpenses().map(e=>e.category))].sort();
  $("categoryFilter").innerHTML=`<option value="all">All categories</option>`+cats.map(c=>`<option ${c===cat?"selected":""}>${esc(c)}</option>`).join("");
}
function renderSummary(){
  $("summaryMonthTitle").textContent=monthLabel(currentMonth);
  const ex=monthExpenses();
  $("summaryTotal").textContent=money(ex.reduce((s,e)=>s+Number(e.amount),0));
  const cats={};ex.forEach(e=>cats[e.category]=(cats[e.category]||0)+Number(e.amount));
  $("categorySummary").innerHTML=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="category-bar"><span>${esc(c)}</span><span class="category-value">${money(v)}</span></div>`).join("")||`<p class="hint">No expenses yet.</p>`;
  const p=calculate();
  $("personSummary").innerHTML=data.roommates.map(n=>{const x=p[n]||{paid:0,share:0,balance:0};return `<div class="person-summary"><div class="person-line"><b>${esc(n)}</b><b class="${x.balance>=0?"positive":"negative"}">${x.balance>=0?"+":"−"}${money(Math.abs(x.balance))}</b></div><div class="person-small">Paid ${money(x.paid)} · Actual share ${money(x.share)}</div></div>`}).join("");
}
function renderParticipants(){
  const type=document.querySelector('input[name="expenseType"]:checked').value;
  $("participants").innerHTML=data.roommates.map((p,i)=>`<label class="person-option"><input type="checkbox" value="${escAttr(p)}" ${type==="common"?"checked":i===0?"checked":""}><span>${esc(p)}</span></label>`).join("");
  document.querySelectorAll("#participants input").forEach(x=>x.disabled=type==="common");
  $("participantHint").textContent=type==="common"?"Common expense: everyone shares it.":"Select only the people who actually shared this expense.";
}
function renderSettings(){
  $("roommatesSettings").innerHTML=data.roommates.map((p,i)=>`<div class="setting-person"><input value="${escAttr(p)}" data-roommate="${i}" maxlength="25"><button class="small-delete" data-delete-roommate="${i}" ${data.roommates.length<=2?"disabled":""}>Remove</button></div>`).join("");
  $("commonSettings").innerHTML=data.commonCategories.map(c=>`<div class="common-item"><span>${esc(c)}</span><span class="muted">Everyone</span></div>`).join("");
}
function addExpense(e){
  e.preventDefault();
  const type=document.querySelector('input[name="expenseType"]:checked').value;
  const selected=[...document.querySelectorAll("#participants input:checked")].map(x=>x.value);
  if(type==="shared"&&selected.length===0){toast("Select at least one person.");return}
  const amount=Number($("amount").value);
  if(!amount||amount<=0){toast("Enter a valid amount.");return}
  data.expenses.push({id:crypto.randomUUID(),amount,description:$("description").value.trim(),category:$("category").value,date:$("expenseDate").value,paidBy:$("paidBy").value,type,sharedBy:type==="common"?[...data.roommates]:selected,created:Date.now()});
  save();toast("Expense added");
  $("expenseForm").reset();$("expenseDate").value=new Date().toISOString().slice(0,10);document.querySelector('input[name="expenseType"][value="common"]').checked=true;renderParticipants();renderAll();showPage("dashboard");
}
function deleteExpense(id){if(!confirm("Delete this expense?"))return;data.expenses=data.expenses.filter(e=>e.id!==id);save();renderAll();toast("Expense deleted")}
function moveMonth(n){currentMonth.setMonth(currentMonth.getMonth()+n);renderAll()}
function showPage(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===name));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  if(name==="settings")renderSettings();
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderAll(){renderDashboard();renderExpenses();renderSummary();renderParticipants();renderSettings()}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function escAttr(s){return esc(s)}

document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll(".text-btn").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$("settingsBtn").onclick=()=>showPage("settings");
$("prevMonth").onclick=()=>moveMonth(-1);$("nextMonth").onclick=()=>moveMonth(1);
$("prevMonthSummary").onclick=()=>moveMonth(-1);$("nextMonthSummary").onclick=()=>moveMonth(1);
$("expenseForm").addEventListener("submit",addExpense);
$("expenseSearch").addEventListener("input",renderExpenses);$("categoryFilter").addEventListener("change",renderExpenses);
document.querySelectorAll('input[name="expenseType"]').forEach(x=>x.addEventListener("change",renderParticipants));
$("selectAll").onclick=()=>document.querySelectorAll("#participants input").forEach(x=>x.checked=true);
$("addRoommate").onclick=()=>{if(data.roommates.length>=8){toast("Maximum 8 roommates.");return}data.roommates.push("Person "+(data.roommates.length+1));save();renderAll();toast("Roommate added")};
$("roommatesSettings").addEventListener("change",e=>{const i=e.target.dataset.roommate;if(i===undefined)return;const old=data.roommates[Number(i)],val=e.target.value.trim()||old;if(data.roommates.some((x,j)=>j!==Number(i)&&x.toLowerCase()===val.toLowerCase())){toast("Names must be unique.");e.target.value=old;return}data.roommates[Number(i)]=val;data.expenses.forEach(x=>{if(x.paidBy===old)x.paidBy=val;x.sharedBy=x.sharedBy.map(p=>p===old?val:p)});save();renderAll()});
$("roommatesSettings").addEventListener("click",e=>{const i=e.target.dataset.deleteRoommate;if(i===undefined)return;const name=data.roommates[Number(i)];if(data.expenses.some(x=>x.paidBy===name||x.sharedBy.includes(name))){toast("This roommate has existing expenses.");return}data.roommates.splice(Number(i),1);save();renderAll()});
$("exportData").onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="roomsplit-backup.json";a.click();URL.revokeObjectURL(a.href)};
$("importData").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!Array.isArray(x.roommates)||!Array.isArray(x.expenses))throw 0;data=x;save();renderAll();toast("Backup imported")}catch{toast("Invalid backup file")}};r.readAsText(f)};
$("clearData").onclick=()=>{if(confirm("Clear all roommates and expenses? This cannot be undone unless you have a backup.")){data=JSON.parse(JSON.stringify(defaultData));save();renderAll();toast("All data cleared")}};
$("expenseDate").value=new Date().toISOString().slice(0,10);
$("paidBy").innerHTML=data.roommates.map(p=>`<option>${esc(p)}</option>`).join("");
renderAll();
