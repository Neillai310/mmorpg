const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const stages = [
  {name:'第一站・青菜小徑', code:'1-1', enemy:'迷路青菜', icon:'🥬', hp:80, reward:12, dish:'鮮蔬暖心碗', image:'assets/dish-veg.png', desc:'嚴選時蔬，簡單煮出踏實好味。'},
  {name:'第二站・魚蛋碼頭', code:'1-2', enemy:'彈跳魚蛋', icon:'🍡', hp:180, reward:24, dish:'魚蛋雞翅撈麵', image:'assets/dish-noodle.png', desc:'彈牙魚蛋配上香嫩雞翅，街坊最愛。'},
  {name:'第三站・咖哩山徑', code:'1-3', enemy:'咖哩石怪', icon:'🪨', hp:420, reward:46, dish:'咖哩牛腩通心粉', image:'assets/dish-curry.png', desc:'慢煮牛腩與濃香咖哩，飽足又暖心。'},
  {name:'終點站・百味廣場', code:'1-4', enemy:'飢餓大王', icon:'👹', hp:900, reward:90, dish:'滋味全席', image:'assets/dish-feast.jpg', desc:'集合街坊心意的一桌滋味盛宴。'}
];
const upgrades = [
  {id:'knife', icon:'🔪', name:'俐落菜刀', desc:'每級 +4 灶火力', base:45, step:4},
  {id:'pot', icon:'🍳', name:'聚香鐵鍋', desc:'每級 +9 灶火力', base:120, step:9},
  {id:'recipe', icon:'📜', name:'街坊食譜', desc:'每級 +2 每秒收益', base:85, step:2},
  {id:'stall', icon:'🏮', name:'暖心攤車', desc:'每級 +6 每秒收益', base:260, step:6}
];
const realMenu = {
  soup:[['清湯原水',0],['蒜香豬骨湯',0],['經典咖哩汁',0],['秘製甜辣滷汁',0]],
  staple:[['白飯',20],['王子麵',20],['烏龍麵',30],['雞絲麵',30],['蒟蒻麵',60]],
  vegetable:[['綜合蔬菜大滿貫',100],['單份時蔬',25]],
  protein:[['青花椒雞胸片',40],['滷水雞翅',40],['豬里肌',45],['皮蛋',30],['雞蛋豆腐',25],['雞腿肉片',40],['牛肉片',50],['牛腱',50],['煎蛋',20],['鯛魚片',80],['魷魚',80],['蝦',80],['火鍋豆腐',10],['黃金豆腐',10],['腐竹',20],['小油皮',20]],
  special:[['豬肉餃子',40],['起司片',20],['牛肉丸',30],['貢丸',30],['花枝丸',30],['魚蛋',30],['蟹肉棒',30],['蝦滑',30],['米血',20],['培根',30],['香腸',35],['午餐肉',30]],
  drink:[['檸水',40],['檸茶',40],['檸綠',40],['檸蜜',40],['檸樂',60],['蜂蜜蘋果醋',60],['薑豆漿',60],['薑棗茶',40]],
  dessert:[['椰汁鮮果撈',120],['仙草鮮果撈',120]],
  spice:[['蔥花',0],['蒜碎',0],['洋蔥',0],['辣椒',0],['白芝麻',0],['油蔥酥',0]]
};
const defaultState = {coins:60, spice:0, level:1, xp:0, stage:0, unlocked:0, wave:0, hp:80, quest:0, claimed:false, levels:{knife:0,pot:0,recipe:0,stall:0}, lastSeen:Date.now(), hero:'bear',gmOrders:[],orderHistory:[],gmRevenue:0,gmCompleted:0,nextOrderId:101,hunger:100,heroHp:100,heroMaxHp:100,inventory:{'武器強化卷軸':1,'防具強化卷軸':1,'暖心便當':2},equipment:{weapon:null,armor:null,weaponPlus:0,armorPlus:0},recruitedCat:false,customerLog:[],chatMessages:[],expeditionLog:[],playerName:'玩家'+Math.floor(1000+Math.random()*9000)};
let state = load();
let cooldowns = {chop:0,soup:0,feast:0};
let soupUntil = 0;
let soundOn = true;
let lastTick = Date.now();
let posCart=[],posCategory='soup',posService='內用',selectedSpices=[],orderFilter='all';
let heroRecovering=false,chatChannel=null,combatTick=0,attackMode='待機',attackModeUntil=0,chatInstanceId='tab-'+Math.random().toString(36).slice(2);

function load(){try{const saved=JSON.parse(localStorage.getItem('tasteinn-save')||'{}');return {...defaultState,...saved,levels:{...defaultState.levels,...(saved.levels||{})},inventory:{...defaultState.inventory,...(saved.inventory||{})},equipment:{...defaultState.equipment,...(saved.equipment||{})}}}catch{return {...defaultState,levels:{...defaultState.levels},inventory:{...defaultState.inventory},equipment:{...defaultState.equipment}}}}
function save(){state.lastSeen=Date.now();localStorage.setItem('tasteinn-save',JSON.stringify(state))}
const levelNeed=()=>60+(state.level-1)*35;
const power=()=>Math.floor((12+(state.level-1)*3+state.levels.knife*4+state.levels.pot*9+(state.equipment.weapon?18:0)+(state.equipment.weaponPlus||0)*6)*(state.recruitedCat?1.15:1)*(state.hunger<20?.7:1));
const income=()=>state.levels.recipe*2+state.levels.stall*6;
const stage=()=>stages[state.stage];
const upgradeCost=u=>Math.floor(u.base*Math.pow(1.55,state.levels[u.id]));
const fmt=n=>n>=1000000?(n/1000000).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':Math.floor(n).toLocaleString();

function render(){
  $('#coins').textContent=fmt(state.coins);$('#spice').textContent=fmt(state.spice);$('#level').textContent=state.level;
  $('#xpText').textContent=`${state.xp} / ${levelNeed()}`;$('#xpBar').style.width=Math.min(100,state.xp/levelNeed()*100)+'%';
  $('#power').textContent=power();if($('#income'))$('#income').textContent=income();
  $('#stageName').textContent=stage().name;$('#stageCount').textContent=stage().code;$('#enemyName').textContent=stage().enemy;$('#enemyTitle').textContent=stage().enemy;$('#enemyIcon').textContent=stage().icon;
  const max=stage().hp; state.hp=Math.min(state.hp,max); $('#hpText').textContent=`${Math.ceil(state.hp)} / ${max}`;$('#hpBar').style.width=Math.max(0,state.hp/max*100)+'%';
  $('#waveText').textContent=`${state.wave} / 8`;$('#pips').innerHTML=Array.from({length:8},(_,i)=>`<i class="${i<state.wave?'done':''}"></i>`).join('');
  $('#orderName').textContent=stage().dish;$('#orderReward').textContent=`+${stage().reward} 🥣`;$('#dishImage').src=stage().image;$('#orderDesc').textContent=stage().desc;
  $('#questBadge').textContent=`${Math.min(state.quest,10)}/10`;$('#questBar').style.width=Math.min(100,state.quest*10)+'%';
  $('#claimQuest').disabled=state.quest<10||state.claimed;$('#claimQuest').textContent=state.claimed?'今日已領取':'領取 120 🥣';
  const heroAsset=state.hero==='bear'?'assets/bear.gif':'assets/cat.gif';$('#heroImage').src=heroAsset;$('#battleHero').src=heroAsset;
  $('#heroName').textContent=state.hero==='bear'?'熊仔店長':'貓仔軍師';$('#heroRole').textContent=state.hero==='bear'?'暖心料理守護者':'精算香料支援手';
  $('#switchHero').textContent=state.hero==='bear'?'切換貓仔夥伴':'切換熊仔店長';
  renderLounge();renderGM();renderOrderBattle();renderExpeditionStatus();renderChat();
}
function battleOrder(){return state.gmOrders.find(o=>o.status==='cooking')||state.gmOrders.find(o=>o.status==='waiting')||state.gmOrders.find(o=>o.status==='ready')}
function estimatePrepSeconds(o){
  const itemUnits=(o.items||[]).reduce((n,item)=>n+(Number((String(item).match(/×(\d+)/)||[])[1])||1),0);
  return Math.max(60,Math.min(300,Math.round(55+itemUnits*32+(Number(o.total)||0)*.42)));
}
function formatPrepTime(seconds){const m=Math.floor(seconds/60),s=seconds%60;return m?`${m} 分 ${s?String(s).padStart(2,'0')+' 秒':''}`:`${s} 秒`}
function orderMaxHp(o){
  if(o.durabilityVersion!==2){o.prepSeconds=estimatePrepSeconds(o);o.maxHp=Math.ceil(Math.max(12,power())*o.prepSeconds/.9);o.hp=o.maxHp;o.durabilityVersion=2}
  return o.maxHp;
}
function renderOrderBattle(){
  const orders=state.gmOrders||[],visible=orders.slice(0,9),o=battleOrder();$('#prevStage').style.visibility='hidden';$('#nextStage').style.visibility='hidden';
  $('#stageName').textContent=orders.length?`九宮訂單遠征・${orders.length} 隻怪物`:'訂單森林・等待 POS 派單';$('#stageCount').textContent=orders.length?`顯示 ${visible.length} / ${orders.length}`:'待機';
  $('#monsterLane').innerHTML=visible.length?visible.map(order=>{const max=orderMaxHp(order);order.maxHp=max;if(typeof order.hp!=='number')order.hp=max;const kind=order.type.startsWith('內用')?'dinein':order.type==='外帶'?'takeout':'delivery',icon=kind==='dinein'?'🍲':kind==='takeout'?'🥡':'🛵',pct=Math.max(0,order.hp/max*100),label=order.status==='waiting'?'接單':order.status==='cooking'?'戰鬥製作中':'確認出餐';return `<article class="order-monster ${order.status}" data-monster="${order.id}" tabindex="0"><div class="monster-orb ${kind}"><i class="monster-eyes"></i><em>${icon}</em><span>#${order.id}</span></div><b>${order.type}</b><div class="mini-hp"><i style="width:${order.status==='waiting'?100:pct}%"></i></div><small>${order.status==='waiting'?'等待接單':order.status==='cooking'?Math.ceil(order.hp)+' / '+max:'料理完成'}</small>${order.status==='cooking'?`<span class="battle-status">⚔ ${formatPrepTime(order.prepSeconds)} 製作戰</span>`:`<button data-expedition-order="${order.id}">${label}</button>`}<div class="order-tooltip"><b>#${order.id} 點餐明細</b><p>${order.items.join('<br>')}</p><span>備註：${order.note||'無'}<br>合計：$${order.total}<br>預估製作：${formatPrepTime(order.prepSeconds)}</span></div></article>`}).join(''):'<div class="expedition-empty"><i>✦</i><b>尚無訂單怪物</b><span>請從上層 POS 彈窗建立訂單</span></div>';
  $$('[data-expedition-order]').forEach(b=>b.onclick=()=>advanceOrder(b.dataset.expeditionOrder));
  if(!o){$('#enemyTitle').textContent='等待 POS 訂單';$('#hpText').textContent='—';$('#hpBar').style.width='0%';$('#waveText').textContent='0 筆';$('#pips').innerHTML='<i></i><i></i><i></i>';$('#orderName').textContent='尚無 POS 訂單';$('#orderReward').textContent='$0';$('#orderDesc').textContent='請由 POS 建立內用、外帶或 EAT送訂單。';return}
  const max=orderMaxHp(o);$('#enemyTitle').textContent=`#${o.id}・${o.status==='waiting'?'等待接單':o.status==='cooking'?'戰鬥製作':'待出餐'}`;$('#hpText').textContent=o.status==='waiting'?'等待接單':o.status==='ready'?'料理完成':`${Math.ceil(o.hp)} / ${max}`;$('#hpBar').style.width=o.status==='waiting'?'100%':Math.max(0,o.hp/max*100)+'%';$('#waveText').textContent=`${orders.length} 隻`;
  $('#pips').innerHTML=orders.slice(0,6).map(x=>`<i class="${x.status==='ready'?'done':''}"></i>`).join('');$('#orderName').textContent=`#${o.id}・${o.type}`;$('#orderReward').textContent=`$${o.total}`;$('#orderDesc').textContent=o.items.join('・');
}
function renderGM(){
  if(!$('#orderInbox'))return;state.gmOrders=Array.isArray(state.gmOrders)?state.gmOrders:[];
  const waiting=state.gmOrders.filter(o=>o.status==='waiting').length,cooking=state.gmOrders.filter(o=>o.status==='cooking'||o.status==='ready').length;
  $('#waitingCount').textContent=waiting;$('#cookingCount').textContent=cooking;$('#gmRevenue').textContent='$'+fmt(state.gmRevenue||0);
  $('#orderInbox').innerHTML=state.gmOrders.length?state.gmOrders.map(o=>`<article class="gm-order ${o.status}"><div class="gm-order-top"><b>#${o.id}・${o.type}</b><span>${Math.max(1,Math.floor((Date.now()-o.created)/60000))} 分鐘前</span></div><p>${o.items.join(' ・ ')}<br><b>備註：</b>${o.note}</p><div class="gm-order-bottom"><strong>$${o.total}</strong><button data-order="${o.id}" class="${o.status==='cooking'||o.status==='ready'?'finish':''}">${o.status==='waiting'?'接受訂單':o.status==='cooking'?'立即備妥':'確認出餐'}</button></div></article>`).join(''):'<div class="gm-empty">目前沒有訂單怪物<br>請先到 POS 建立訂單</div>';
  $$('[data-order]').forEach(b=>b.onclick=()=>advanceOrder(b.dataset.order));
}
function advanceOrder(id){
  const order=state.gmOrders.find(o=>o.id===id);if(!order)return;
  if(order.status==='waiting'){order.status='cooking';order.accepted=Date.now();order.hp=orderMaxHp(order);speak(`接下 #${id}，開始料理！`);addExpeditionMessage(`#${id} 接單成功，進入互相攻擊`, 'red');showBattleText(`#${id} 戰鬥開始`, 'red');showToast(`#${id} 已接單・怪物戰開始`)}
  else if(order.status==='cooking'){markOrderReady(order,false)}
  else if(order.status==='ready'){state.gmRevenue=(state.gmRevenue||0)+order.total;state.gmCompleted=(state.gmCompleted||0)+1;state.gmOrders=state.gmOrders.filter(o=>o.id!==id);state.orderHistory=Array.isArray(state.orderHistory)?state.orderHistory:[];state.orderHistory.unshift({...order,status:'done',completed:Date.now()});state.orderHistory=state.orderHistory.slice(0,100);state.customerLog=Array.isArray(state.customerLog)?state.customerLog:[];state.customerLog.unshift({id,channel:order.type,items:order.items.slice(0,3),spent:order.total,time:Date.now()});state.customerLog=state.customerLog.slice(0,60);addExpeditionMessage(`#${id} 確認出餐，營業額 +$${order.total}`,'gold');showToast(`#${id} 已出餐・營業額 +$${order.total}`)}
  save();render();renderOrderManager();
}
function markOrderReady(order,fromBattle=true){
  if(!order||order.status==='ready')return;order.status='ready';order.hp=0;if(!order.rewarded){order.rewarded=true;const coinDrop=Math.max(10,Math.floor(order.total/5));state.coins+=coinDrop;state.xp+=12;state.quest++;state.hunger=Math.max(0,state.hunger-5);grantLoot(order,coinDrop);while(state.xp>=levelNeed()){state.xp-=levelNeed();state.level++;state.spice++}}
  addExpeditionMessage(`#${order.id} 訂單怪物擊破，等待出餐`,'gold');showBattleText(`#${order.id} 擊破！`,'gold');speak('訂單怪物已擊破，等待出餐！');showToast(`#${order.id} 料理完成${fromBattle?'・怪物擊破':''}`);save();
}
function addInventory(name,qty=1){state.inventory[name]=(state.inventory[name]||0)+qty}
function grantLoot(order,coins){
  const table=['血之刃','武器強化卷軸','防具強化卷軸','暖心便當','森靈皮甲'],item=!state.inventory['血之刃']?'血之刃':table[Math.floor(Math.random()*table.length)];addInventory(item);addExpeditionMessage(`獲得 ${coins} 滋味幣、${item} ×1`,'gold');showBattleText(`🪙 +${coins}　${item}`,'gold');spawnDrops(coins,item);renderLounge();
}
function spawnDrops(coins,item){
  const icons={'血之刃':'🗡️','武器強化卷軸':'📜','防具強化卷軸':'📘','暖心便當':'🍱','森靈皮甲':'🛡️'},layer=$('#dropLayer');if(!layer)return;const group=document.createElement('div');group.className='loot-group';group.style.left=(12+Math.random()*58)+'%';group.innerHTML=`<span class="loot-drop coin-drop">🪙<b>+${coins}</b></span><span class="loot-drop item-drop">${icons[item]||'🎁'}<b>${item}</b></span>`;layer.appendChild(group);setTimeout(()=>group.remove(),2200)
}
function menuHtml(){
  const labels={soup:'湯底風味',staple:'優質碳水（主食）',vegetable:'高纖蔬菜',protein:'肉類・蛋品・海鮮・豆製品',special:'特色單品與丸餃',drink:'清涼佐餐飲品',dessert:'鮮果甜品'};
  return `<h2>滋味亭真實菜單</h2><p>依照 A4 菜單建立。湯底未標示單獨價格；天然辛香料可複選。</p>${Object.entries(realMenu).map(([key,items])=>`<div class="feature"><span>${({soup:'🥣',staple:'🍜',vegetable:'🥬',protein:'🥩',special:'🍡',drink:'🧊',dessert:'🍨'})[key]}</span><div><h3>${labels[key]}</h3><p>${items.map(x=>`${x[0]}${x[1]?' $'+x[1]:''}`).join('・')}</p></div></div>`).join('')}`;
}
const posMeta={soup:['湯底','🥣'],staple:['主食','🍜'],vegetable:['蔬菜','🥬'],protein:['肉蛋海鮮','🥩'],special:['丸餃單品','🍡'],drink:['飲品','🧊'],dessert:['甜品','🍨']};
function openPOS(){
  $('#posScreen').classList.add('open');$('#posScreen').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';switchPosTab('sale');renderPOS();
}
function closePOS(){$('#posScreen').classList.remove('open');$('#posScreen').setAttribute('aria-hidden','true');document.body.style.overflow='';}
function switchPosTab(tab){
  $$('.pos-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.posTab===tab));$('#saleView').classList.toggle('active',tab==='sale');$('#manageView').classList.toggle('active',tab==='manage');if(tab==='manage')renderOrderManager();
}
function renderPOS(){
  $('#categoryTabs').innerHTML=Object.entries(posMeta).map(([key,m])=>`<button data-category="${key}" class="${key===posCategory?'active':''}">${m[1]} ${m[0]}</button>`).join('');
  $$('#categoryTabs button').forEach(b=>b.onclick=()=>{posCategory=b.dataset.category;renderPOS()});
  $('#posItems').innerHTML=realMenu[posCategory].map((item,i)=>{const key=posCategory+'-'+i,found=posCart.find(x=>x.key===key);return `<button class="pos-item ${found?'selected':''}" data-pos-item="${key}"><span>${posMeta[posCategory][1]}</span><b>${item[0]}</b><strong>${item[1]?'$'+item[1]:'湯底'}</strong>${found?`<em>${found.qty}</em>`:''}</button>`}).join('');
  $$('[data-pos-item]').forEach(b=>b.onclick=()=>addPosItem(b.dataset.posItem));renderCart();
}
function addPosItem(key){
  const [cat,indexText]=key.split('-'),index=Number(indexText),item=realMenu[cat][index];
  if(cat==='soup')posCart=posCart.filter(x=>x.category!=='soup');const found=posCart.find(x=>x.key===key);if(found)found.qty++;else posCart.push({key,category:cat,name:item[0],price:item[1],qty:1});renderPOS();
}
function changeQty(key,d){const item=posCart.find(x=>x.key===key);if(!item)return;item.qty+=d;if(item.qty<=0)posCart=posCart.filter(x=>x.key!==key);renderPOS()}
function renderCart(){
  if(!$('#cartItems'))return;const table=$('#tableNo').value.trim()||'未填';$('#cartService').textContent=posService==='內用'?`內用・桌號 ${table}`:posService;$('#tableField').style.display=posService==='內用'?'block':'none';
  $('#cartItems').innerHTML=posCart.length?posCart.map(x=>`<div class="cart-row"><div><b>${x.name}</b><small>${x.price?'$'+x.price:'湯底不另計價'}</small></div><div class="qty-control"><button data-qty="${x.key}" data-d="-1">−</button><span>${x.qty}</span><button data-qty="${x.key}" data-d="1">＋</button></div><strong>$${x.price*x.qty}</strong></div>`).join(''):'<div class="empty-cart">尚未選擇品項<br>請從左側菜單點餐</div>';
  $$('[data-qty]').forEach(b=>b.onclick=()=>changeQty(b.dataset.qty,Number(b.dataset.d)));
  $('#spiceOptions').innerHTML=realMenu.spice.map(x=>`<button class="spice-option ${selectedSpices.includes(x[0])?'active':''}" data-spice="${x[0]}">${x[0]}</button>`).join('');
  $$('[data-spice]').forEach(b=>b.onclick=()=>{const s=b.dataset.spice;selectedSpices=selectedSpices.includes(s)?selectedSpices.filter(x=>x!==s):[...selectedSpices,s];renderCart()});
  const total=posCart.reduce((n,x)=>n+x.price*x.qty,0);$('#cartTotal').textContent='$'+total;$('#checkoutBtn').disabled=posCart.length===0;$('#posOrderBadge').textContent=state.gmOrders.length;
}
function clearPOS(){posCart=[];selectedSpices=[];$('#posNote').value='';renderPOS()}
function checkoutPOS(){
  if(!posCart.length)return;const table=$('#tableNo').value.trim()||'未填桌號',total=posCart.reduce((n,x)=>n+x.price*x.qty,0),note=$('#posNote').value.trim();
  const items=posCart.map(x=>x.name+(x.qty>1?` ×${x.qty}`:''));if(selectedSpices.length)items.push('辛香料：'+selectedSpices.join('、'));
  const id='A'+state.nextOrderId++,order={id,items,total,type:posService==='內用'?`內用・${table}`:posService,note:note||'無',status:'waiting',created:Date.now(),source:'POS'};orderMaxHp(order);state.gmOrders.push(order);addExpeditionMessage(`紅色警報：#${id} ${posService} 訂單怪物出現（預估 ${formatPrepTime(order.prepSeconds)}）`,'red');showBattleText(`#${id} 訂單怪物出現`,'red');save();clearPOS();render();renderOrderManager();showToast(`#${id} 已化為訂單怪物`);
}
function renderOrderManager(){
  state.orderHistory=Array.isArray(state.orderHistory)?state.orderHistory:[];const active=state.gmOrders||[],history=state.orderHistory||[],all=[...active,...history];
  $('#manageWaiting').textContent=active.filter(o=>o.status==='waiting').length;$('#manageCooking').textContent=active.filter(o=>o.status==='cooking').length;$('#manageReady').textContent=active.filter(o=>o.status==='ready').length;$('#manageDone').textContent=history.length;$('#manageRevenue').textContent='$'+fmt(state.gmRevenue||0);$('#posOrderBadge').textContent=active.length;
  $$('.manage-filters button').forEach(b=>b.classList.toggle('active',b.dataset.filter===orderFilter));const filtered=orderFilter==='all'?all:all.filter(o=>o.status===orderFilter);
  const statusName={waiting:'待接單',cooking:'製作戰鬥中',ready:'待出餐',done:'已完成'};
  $('#manageOrders').innerHTML=filtered.length?filtered.map(o=>`<article class="manage-order ${o.status}"><div class="manage-order-head"><h3>#${o.id}・${o.type}</h3><span class="status-pill">${statusName[o.status]}</span></div><p>${o.items.join(' ・ ')}</p><p class="manage-order-note">備註：${o.note||'無'}</p><div class="manage-order-foot"><strong>$${o.total}</strong>${o.status==='done'?`<small>${new Date(o.completed).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})} 完成</small>`:`<button data-manage-order="${o.id}" class="${o.status==='cooking'||o.status==='ready'?'finish':''}">${o.status==='waiting'?'接受訂單':o.status==='cooking'?'立即備妥':'確認出餐'}</button>`}</div></article>`).join(''):'<div class="manage-empty">此分類目前沒有訂單</div>';
  $$('[data-manage-order]').forEach(b=>b.onclick=()=>advanceOrder(b.dataset.manageOrder));
}
function renderLounge(){
  if(!$('#inventoryGrid'))return;state.hunger=Math.max(0,Math.min(100,state.hunger??100));$('#hungerText').textContent=`${state.hunger} / 100`;$('#hungerBar').style.width=state.hunger+'%';
  const weapon=state.equipment.weapon?`${state.equipment.weapon} +${state.equipment.weaponPlus||0}`:'未裝備',armor=state.equipment.armor?`${state.equipment.armor} +${state.equipment.armorPlus||0}`:'未裝備';$('#weaponSlot b').textContent=weapon;$('#armorSlot b').textContent=armor;$('#combatBonus').textContent=`裝備加成 +${(state.equipment.weapon?18:0)+(state.equipment.weaponPlus||0)*6+(state.equipment.armor?12:0)+(state.equipment.armorPlus||0)*4}`;
  const icons={'血之刃':'🗡️','森靈皮甲':'🛡️','武器強化卷軸':'📜','防具強化卷軸':'📘','暖心便當':'🍱'};$('#inventoryGrid').innerHTML=Object.entries(state.inventory).filter(([,q])=>q>0).map(([name,qty])=>`<button data-use-item="${name}"><span>${icons[name]||'🎁'}</span><b>${name}</b><small>×${qty}</small></button>`).join('')||'<div class="empty-inventory">擊敗訂單怪物可獲得道具</div>';
  $$('[data-use-item]').forEach(b=>b.onclick=()=>useInventoryItem(b.dataset.useItem));$('#enhanceWeapon').onclick=()=>enhanceEquipment('weapon');$('#enhanceArmor').onclick=()=>enhanceEquipment('armor');$('#eatMeal').onclick=()=>useInventoryItem('暖心便當');$('#recruitCat').onclick=recruitCompanion;$('#recruitCat').disabled=state.recruitedCat;$('#recruitCat').textContent=state.recruitedCat?'貓仔已加入隊伍':'招募・300 🥣';$('#upgradeDot').style.display=Object.keys(state.inventory).some(k=>state.inventory[k]>0)?'block':'none';
}
function useInventoryItem(name){
  if((state.inventory[name]||0)<=0)return showToast(`沒有${name}`);if(name==='血之刃'){state.equipment.weapon='血之刃';showToast('已裝備血之刃')}else if(name==='森靈皮甲'){state.equipment.armor='森靈皮甲';showToast('已裝備森靈皮甲')}else if(name==='暖心便當'){state.inventory[name]--;state.hunger=Math.min(100,state.hunger+40);showToast('飢餓度 +40')}else return showToast('請使用下方強化功能');save();render()
}
function enhanceEquipment(slot){const scroll=slot==='weapon'?'武器強化卷軸':'防具強化卷軸';if(!state.equipment[slot])return showToast(`請先裝備${slot==='weapon'?'武器':'防具'}`);if((state.inventory[scroll]||0)<=0)return showToast(`沒有${scroll}`);state.inventory[scroll]--;const success=Math.random()<.7;if(success)state.equipment[slot+'Plus']=(state.equipment[slot+'Plus']||0)+1;showToast(success?'強化成功！':'強化失敗，裝備沒有損壞');save();render()}
function recruitCompanion(){if(state.recruitedCat)return;if(state.coins<300)return showToast('滋味幣不足 300');state.coins-=300;state.recruitedCat=true;showToast('貓仔軍師加入！全隊攻擊 +15%');save();render()}
function attack(mult=1){
  const targets=(state.gmOrders||[]).slice(0,9).filter(o=>o.status==='cooking');if(!targets.length){attackMode='待機';renderOrderBattle();renderExpeditionStatus();return}attackMode=mult>1?'疾速備料攻擊':Date.now()<soupUntil?'暖心湯氣攻擊':'自動料理攻擊';attackModeUntil=Date.now()+760;let totalDmg=0;targets.forEach(order=>{const dmg=Math.ceil(power()*mult*(.88+Math.random()*.24)*(Date.now()<soupUntil?2:1));order.hp-=dmg;totalDmg+=dmg;if(order.hp<=0)markOrderReady(order,true)});
  $('#heroFighter').classList.remove('attack');$('#enemy').classList.remove('hit');$('#projectile').classList.remove('fly');void $('#heroFighter').offsetWidth;
  $('#heroFighter').classList.add('attack');$('#enemy').classList.add('hit');$('#projectile').classList.add('fly');
  $('#damageNumber').textContent='-'+totalDmg;$('#damageNumber').classList.remove('pop');void $('#damageNumber').offsetWidth;$('#damageNumber').classList.add('pop');render();
}
function completeOrder(){
  const reward=stage().reward;state.coins+=reward;state.xp+=10+state.stage*4;state.wave++;state.quest++;state.hp=stage().hp;
  addLog(`完成「${stage().dish}」，獲得 ${reward} 滋味幣`);speak(['熱騰騰上桌！','這碗有家的味道！','街坊久等啦！'][Math.floor(Math.random()*3)]);
  while(state.xp>=levelNeed()){state.xp-=levelNeed();state.level++;state.spice++;showToast(`升到 LV.${state.level}，獲得神秘香料！`)}
  if(state.wave>=8){state.wave=0;if(state.stage<stages.length-1){if(state.stage===state.unlocked)state.unlocked++;state.stage++;state.hp=stage().hp;showToast(`新地區開放：${stage().name}`)}else{state.spice+=3;state.coins+=250;showToast('完成一輪遠征！獲得 3 香料與 250 滋味幣')}}
  save();
}
function buyUpgrade(id){const u=upgrades.find(x=>x.id===id),cost=upgradeCost(u);if(state.coins<cost)return;state.coins-=cost;state.levels[id]++;addLog(`${u.name}升至 LV.${state.levels[id]}`);showToast(`${u.name}升級成功！`);save();render()}
function useSkill(type){if(cooldowns[type]>Date.now())return;const settings={chop:[6000,5],soup:[14000,0],feast:[25000,99]};cooldowns[type]=Date.now()+settings[type][0];
  if(type==='chop'){attack(settings[type][1]);speak('俐落備料！')}
  if(type==='soup'){soupUntil=Date.now()+8000;attackMode='暖心湯氣・火力 ×2';attackModeUntil=soupUntil;speak('暖心湯氣，全力開火！');showToast('8 秒內灶火力 ×2')}
}
function feast(){if(cooldowns.feast>Date.now())return;const targets=(state.gmOrders||[]).slice(0,9).filter(o=>o.status==='cooking');if(!targets.length)return showToast('請先由 POS 建單並接受訂單');cooldowns.feast=Date.now()+25000;attackMode='滋味盛宴';attackModeUntil=Date.now()+1600;targets.forEach(order=>{order.hp=0;markOrderReady(order,true)});speak('滋味盛宴，全部上桌！');render()}
function updateCooldowns(){$$('.skill').forEach(b=>{const left=Math.max(0,cooldowns[b.dataset.skill]-Date.now());b.classList.toggle('cooling',left>0);b.dataset.left=left>0?`${(left/1000).toFixed(1)}s`:''})}
function escapeHtml(v){return String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function addExpeditionMessage(text,type='gold'){state.expeditionLog=Array.isArray(state.expeditionLog)?state.expeditionLog:[];state.expeditionLog.push({text,type,time:Date.now()});state.expeditionLog=state.expeditionLog.slice(-40);renderExpeditionStatus()}
function showBattleText(text,type='gold'){const layer=$('#battleTextLayer');if(!layer)return;const el=document.createElement('span');el.className=`battle-float ${type}`;el.textContent=text;el.style.left=(28+Math.random()*50)+'%';layer.appendChild(el);setTimeout(()=>el.remove(),1800)}
function renderExpeditionStatus(){
  if(!$('#partyHpBar'))return;const max=state.heroMaxHp||100;state.heroHp=Math.max(0,Math.min(max,state.heroHp??max));$('#partyHpBar').style.width=(state.heroHp/max*100)+'%';$('#partyHpText').textContent=`${Math.ceil(state.heroHp)} / ${max}`;$('#partyHungerBar').style.width=state.hunger+'%';$('#partyHungerText').textContent=`${state.hunger} / 100`;$('#heroFighter').classList.toggle('fainted',heroRecovering||state.heroHp<=0);
  const fighting=(state.gmOrders||[]).filter(o=>o.status==='cooking').length;
  $('#partyStatusText').textContent=heroRecovering?'隊伍休息恢復中':fighting?`與 ${fighting} 隻訂單怪互相攻擊`:'自動戰鬥待機';
  const mode=heroRecovering?'力竭恢復中':Date.now()<attackModeUntil?attackMode:fighting?'自動料理攻擊':'待機',attackState=$('#attackState');
  if(attackState){attackState.textContent='● '+mode;attackState.className='attack-state '+(heroRecovering?'recovering':fighting||Date.now()<attackModeUntil?'attacking':'idle')}
  const log=state.expeditionLog||[];$('#expeditionLog').innerHTML=log.length?log.slice(-18).map(m=>`<p class="${m.type}"><time>${new Date(m.time).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time>${escapeHtml(m.text)}</p>`).join(''):'<p class="muted">等待 POS 訂單訊息…</p>';$('#expeditionLog').scrollTop=$('#expeditionLog').scrollHeight;
}
function monsterCounterAttack(){
  if(heroRecovering)return;const attackers=(state.gmOrders||[]).slice(0,9).filter(o=>o.status==='cooking');if(!attackers.length)return;const dmg=attackers.reduce((n,o)=>n+Math.max(1,Math.floor(2+o.total/120)),0);state.heroHp=Math.max(0,state.heroHp-dmg);combatTick++;showBattleText(`隊伍受傷 -${dmg}`,'red');if(combatTick%3===0)addExpeditionMessage(`${attackers.length} 隻訂單怪反擊，隊伍受到 ${dmg} 傷害`,'red');if(state.heroHp<=0){heroRecovering=true;addExpeditionMessage('隊伍力竭，休息 4 秒後重新出發','red');showBattleText('隊伍力竭！','red');setTimeout(()=>{state.heroHp=state.heroMaxHp||100;state.hunger=Math.max(0,state.hunger-5);heroRecovering=false;addExpeditionMessage('隊伍恢復完成，重新加入戰鬥','gold');render()},4000)}renderExpeditionStatus()
}
function initChat(){
  state.chatMessages=Array.isArray(state.chatMessages)?state.chatMessages:[];if('BroadcastChannel'in window){chatChannel=new BroadcastChannel('tasteinn-expedition-chat');chatChannel.onmessage=e=>{const m=e.data;if(!m||m.sourceId===chatInstanceId)return;state.chatMessages.push(m);state.chatMessages=state.chatMessages.slice(-60);renderChat()}}
}
function sendChat(text){text=text.trim();if(!text)return;const msg={sender:state.playerName,text,time:Date.now(),sourceId:chatInstanceId};state.chatMessages.push(msg);state.chatMessages=state.chatMessages.slice(-60);if(chatChannel)chatChannel.postMessage(msg);save();renderChat()}
function renderChat(){if(!$('#chatMessages'))return;const rows=state.chatMessages||[];$('#chatMessages').innerHTML=rows.length?rows.slice(-30).map(m=>`<p><time>${new Date(m.time).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}</time><b>${escapeHtml(m.sender)}</b>：${escapeHtml(m.text)}</p>`).join(''):`<p class="muted">你是 ${escapeHtml(state.playerName)}，輸入第一句話吧。</p>`;$('#chatMessages').scrollTop=$('#chatMessages').scrollHeight}
function addLog(text){const li=document.createElement('li');li.textContent=`${new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}　${text}`;$('#battleLog').prepend(li);while($('#battleLog').children.length>4)$('#battleLog').lastChild.remove()}
function speak(text){$('#heroSpeech').textContent=text;$('#heroSpeech').classList.add('show');setTimeout(()=>$('#heroSpeech').classList.remove('show'),1800)}
let toastTimer;function showToast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),1900)}
function showModal(html){$('#modalContent').innerHTML=html;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false')}
function hideModal(){$('#modal').classList.remove('open');$('#modal').setAttribute('aria-hidden','true')}

function init(){
  const offline=Math.min(4*3600,Math.max(0,(Date.now()-(state.lastSeen||Date.now()))/1000));const earned=Math.floor(offline*income());
  if(earned>0){state.coins+=earned;setTimeout(()=>showModal(`<h2>歡迎回到灶房！</h2><p>熊仔和貓仔在你離開時，也有好好照顧街坊。</p><div class="big-reward">+${fmt(earned)} 🥣</div><button class="modal-action" onclick="document.querySelector('#modalClose').click()">收下離線收益</button>`),350)}
  state.hp=state.hp>0?state.hp:stage().hp;
  state.gmOrders=(Array.isArray(state.gmOrders)?state.gmOrders:[]).filter(o=>o.source==='POS');state.orderHistory=(Array.isArray(state.orderHistory)?state.orderHistory:[]).filter(o=>o.source==='POS');
  initChat();render();addLog('灶火點燃，開始自動料理');
  $$('.skill').forEach(b=>b.onclick=()=>b.dataset.skill==='feast'?feast():useSkill(b.dataset.skill));
  $('#claimQuest').onclick=()=>{if(state.quest>=10&&!state.claimed){state.coins+=120;state.claimed=true;showToast('委託完成，獲得 120 滋味幣！');save();render()}};
  $('#switchHero').onclick=()=>{state.hero=state.hero==='bear'?'cat':'bear';showToast(state.hero==='bear'?'熊仔店長上場！':'貓仔夥伴上場！');save();render()};
  $('#soundBtn').onclick=()=>{soundOn=!soundOn;$('#soundBtn').textContent=soundOn?'♪':'×';showToast(soundOn?'音效已開啟':'音效已關閉')};
  $('#prevStage').onclick=()=>changeStage(-1);$('#nextStage').onclick=()=>changeStage(1);
  $('#newOrderBtn').onclick=openPOS;
  $('#posClose').onclick=closePOS;$$('[data-pos-tab]').forEach(b=>b.onclick=()=>switchPosTab(b.dataset.posTab));
  $$('[data-service]').forEach(b=>b.onclick=()=>{posService=b.dataset.service;$$('[data-service]').forEach(x=>x.classList.toggle('active',x===b));renderCart()});
  $('#tableNo').oninput=renderCart;$('#clearCart').onclick=clearPOS;$('#checkoutBtn').onclick=checkoutPOS;
  $$('.manage-filters button').forEach(b=>b.onclick=()=>{orderFilter=b.dataset.filter;renderOrderManager()});
  $('#chatForm').onsubmit=e=>{e.preventDefault();const input=$('#chatInput');sendChat(input.value);input.value=''};
  $('#modalClose').onclick=hideModal;$('#modal').onclick=e=>{if(e.target===$('#modal'))hideModal()};
  $('#resetBtn').onclick=()=>showModal(`<h2>重新開始遠征？</h2><p>所有等級、裝備與滋味幣都會歸零。</p><button class="modal-action" id="confirmReset">確定重新開始</button>`);
  $('#modalContent').addEventListener('click',e=>{if(e.target.id==='confirmReset'){localStorage.removeItem('tasteinn-save');location.reload()}});
  $$('.bottom-nav button[data-panel]').forEach(b=>b.onclick=()=>nav(b));
  setInterval(tick,900);setInterval(()=>{save()},5000);window.addEventListener('beforeunload',save);
}
function changeStage(d){const n=Math.max(0,Math.min(stages.length-1,state.stage+d));if(n===state.stage)return showToast(d>0?'已經是最遠路線':'已經是第一站');if(n>state.unlocked)return showToast('下一站會隨遠征進度解鎖');state.stage=n;state.wave=0;state.hp=stage().hp;showToast(`前往 ${stage().name}`);save();render()}
function customerHtml(){const list=Array.isArray(state.customerLog)?state.customerLog:[];return `<h2>客人名冊</h2><p>每筆完成出餐的訂單都會成為一筆客人紀錄。</p><div class="customer-list">${list.length?list.map((c,i)=>`<div class="feature"><span>${c.channel.startsWith('內用')?'🧑':c.channel==='外帶'?'🚶':'🛵'}</span><div><h3>客人 ${String(list.length-i).padStart(3,'0')}・${c.channel}</h3><p>${c.items.join('・')}｜消費 $${c.spent}<br>${new Date(c.time).toLocaleString('zh-TW')}</p></div></div>`).join(''):'<div class="gm-empty">尚無客人紀錄，完成第一筆出餐後會出現在這裡。</div>'}</div>`}
function nav(b){$$('.bottom-nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');const p=b.dataset.panel;$('#upgradeDrawer').classList.toggle('open',p==='lounge');if(p==='battle')window.scrollTo({top:0,behavior:'smooth'});if(p==='lounge')$('#upgradeDrawer').scrollIntoView({behavior:'smooth'});if(p==='codex')openPOS();if(p==='customers')showModal(customerHtml())}
function tick(){const now=Date.now(),dt=(now-lastTick)/1000;lastTick=now;state.coins+=income()*dt;attack();monsterCounterAttack();updateCooldowns()}

init();
