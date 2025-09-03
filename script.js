// ====== ユーティリティ ======
const $ = (sel) => document.querySelector(sel);
const wheel = $("#wheel");
const wheelGroup = $("#wheelGroup");
const resultEl = $("#result");
const reportBox = $("#reportBox");
const reportList = $("#reportList");

// HSV→RGB（鮮やかな配色を自動生成）
function hsvToRgb(h, s, v){
  let f = (n, k=(n + h/60)%6) => v - v*s*Math.max(Math.min(k,4-k,1),0);
  return [f(5), f(3), f(1)].map(x => Math.round(x*255));
}
function rgbToHex([r,g,b]){ return `#${[r,g,b].map(x => x.toString(16).padStart(2,'0')).join('')}`; }

// 相対輝度・コントラスト比
function relLuminance(hex){
  const [r,g,b] = hex.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)/255).map(v=>{
    return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function contrastRatio(hex1, hex2){
  const L1 = relLuminance(hex1), L2 = relLuminance(hex2);
  const [a,b] = L1 > L2 ? [L1,L2] : [L2,L1];
  return (a + 0.05) / (b + 0.05);
}
function bestTextColor(bg){
  const cWhite = contrastRatio(bg, "#ffffff");
  const cBlack = contrastRatio(bg, "#000000");
  return cWhite >= cBlack ? "#ffffff" : "#000000";
}

// 座標変換
function deg2rad(d){ return (d * Math.PI) / 180; }
function polar(cx, cy, r, deg){
  const rad = deg2rad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ドーナツ型スライスのパス
function donutSlicePath(cx, cy, rOuter, rInner, startDeg, endDeg){
  const largeArc = (endDeg - startDeg) % 360 > 180 ? 1 : 0;
  const p1 = polar(cx, cy, rOuter, startDeg);
  const p2 = polar(cx, cy, rOuter, endDeg);
  const p3 = polar(cx, cy, rInner, endDeg);
  const p4 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z"
  ].join(" ");
}

// ====== 盤面生成 ======
let labels = [];
let fontPx = 24;
let useStroke = true;
let currentRotation = 0;
const CX=250, CY=250, R_OUT=230, R_IN=120; // ドーナツ半径
let colors = [];

function buildColors(n){
  colors = Array.from({length:n}, (_,i)=>{
    const h = Math.round((360 / n) * i);
    const rgb = hsvToRgb(h, 0.65, 0.98);
    return rgbToHex(rgb);
  });
}

function buildWheel(){
  wheelGroup.innerHTML = "";
  const n = labels.length;
  if(n === 0) return;

  buildColors(n);
  const sliceAngle = 360 / n;

  for(let i=0;i<n;i++){
    const start = -90 + i*sliceAngle;
    const end = start + sliceAngle;
    const mid = start + sliceAngle/2;

    // スライスパス
    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d", donutSlicePath(CX,CY,R_OUT,R_IN,start,end));
    path.setAttribute("fill", colors[i]);
    path.setAttribute("stroke", "#111");
    path.setAttribute("stroke-width", "1");
    wheelGroup.appendChild(path);

    // ラベル（常に正向きに補正）
    const rText = (R_OUT + R_IN) / 2;
    const pos = polar(CX, CY, rText, mid);
    let rotate = mid + 90; // 接線方向に
    if(rotate > 90 && rotate < 270){ rotate -= 180; } // 逆さ防止

    const text = document.createElementNS("http://www.w3.org/2000/svg","text");
    text.classList.add("slice-label");
    text.setAttribute("x", pos.x.toFixed(2));
    text.setAttribute("y", pos.y.toFixed(2));
    text.setAttribute("transform", `rotate(${rotate.toFixed(2)}, ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`);
    text.setAttribute("font-size", `${fontPx}px`);

    const bg = colors[i];
    const fg = bestTextColor(bg);
    text.setAttribute("fill", fg);
    if(useStroke){
      text.setAttribute("stroke", fg === "#000000" ? "#ffffff" : "#000000");
      text.setAttribute("stroke-width", "3");
    } else {
      text.setAttribute("stroke", "none");
    }

    // ラベルの詰め調整：弧長の90%に収める
    const arcLen = 2 * Math.PI * ((R_OUT+R_IN)/2) * (sliceAngle/360);
    text.setAttribute("textLength", Math.max(arcLen*0.88, 40).toFixed(0));
    text.setAttribute("lengthAdjust", "spacingAndGlyphs");

    text.textContent = labels[i];
    wheelGroup.appendChild(text);
  }

  // 視認性レポート
  renderReport();
}

function renderReport(){
  const show = $("#showReport").checked;
  reportBox.open = show;
  reportBox.style.display = show ? "block" : "none";
  reportList.innerHTML = "";
  labels.forEach((lab,i)=>{
    const bg = colors[i];
    const fg = bestTextColor(bg);
    const ratio = contrastRatio(bg, fg);
    const li = document.createElement("li");
    const score = ratio.toFixed(2);
    li.textContent = `${i+1}. ${lab} — 背景 ${bg} / 文字 ${fg} → コントラスト比 ${score}:1`;
    reportList.appendChild(li);
  });
}

// ====== スピン ======
let spinning = false;

function spin(){
  if(spinning || labels.length === 0) return;
  spinning = true;
  $("#spin").disabled = true;

  // 当選インデックスをランダムに
  const n = labels.length;
  const idx = Math.floor(Math.random() * n);
  const sliceAngle = 360 / n;
  const centerDeg = -90 + idx*sliceAngle + sliceAngle/2;

  // 中心がポインタ（-90度）に来るように回転量を計算
  const turns = 30 + Math.floor(Math.random()*10); // 30〜39回転
  const targetRotation = (turns*360) + (-90 - centerDeg);

  const finalRotation = currentRotation + targetRotation;

  wheelGroup.classList.add("spin-anim");
  wheelGroup.setAttribute("transform", `rotate(${finalRotation}, ${CX}, ${CY})`);

  // アニメ完了後
  const onEnd = ()=>{
    wheelGroup.classList.remove("spin-anim");
    // Keep the absolute rotation so each spin animates with full turns.
    currentRotation = finalRotation;
    wheelGroup.removeEventListener("transitionend", onEnd);
    const winner = labels[idx];
    resultEl.textContent = `当選：${winner}`;
    spinning = false;
    $("#spin").disabled = false;
  };
  wheelGroup.addEventListener("transitionend", onEnd);
}

// ====== イベントと初期化 ======
function readLabels(){
  labels = $("#labelsInput").value
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}
function applySettings(){
  readLabels();
  fontPx = parseInt($("#fontSize").value,10);
  useStroke = $("#boldEdges").checked;
  $("#fontSizeVal").textContent = `${fontPx}px`;
  buildWheel();
}
$("#apply").addEventListener("click", applySettings);
$("#fontSize").addEventListener("input", ()=>{
  $("#fontSizeVal").textContent = `${$("#fontSize").value}px`;
  fontPx = parseInt($("#fontSize").value,10);
  buildWheel();
});
$("#boldEdges").addEventListener("change", buildWheel);
$("#showReport").addEventListener("change", renderReport);
$("#spin").addEventListener("click", spin);

// 初期描画
applySettings();
