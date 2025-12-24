// === Elementos del DOM ===
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imageInput = document.getElementById("imageInput");
const instruction = document.getElementById("instruction");
const output = document.getElementById("output");
const resetBtn = document.getElementById("resetBtn");
const undoBtn = document.getElementById("undoBtn");

// === Estado de la Aplicación ===
let img = new Image();
let points = [];
let currentPoint = null;
let scale = 1; 
const LUPA_RADIO = 90;
const LUPA_OFFSET = 140;

const labels = [
  "Cartílago trirradiado derecho", 
  "Cartílago trirradiado izquierdo",
  "Borde lateral acetábulo D° (Perkins)", 
  "Borde lateral acetábulo I° (Perkins)",
  "Borde lateral cabeza femoral D°", 
  "Borde medial cabeza femoral D°",
  "Borde lateral cabeza femoral I°", 
  "Borde medial cabeza femoral I°"
];

// === 1. CARGA Y OPTIMIZACIÓN DE IMAGEN ===
imageInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      const MAX_SIZE = 1200;
      let w = tempImg.width;
      let h = tempImg.height;
      const ratio = w / h;
      if (w > h && w > MAX_SIZE) {
        w = MAX_SIZE; h = w / ratio;
      } else if (h > MAX_SIZE) {
        h = MAX_SIZE; w = h * ratio;
      }
      const offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
      offCanvas.getContext('2d').drawImage(tempImg, 0, 0, w, h);
      img = new Image();
      img.onload = initCanvas;
      img.src = offCanvas.toDataURL('image/jpeg', 0.9);
    };
    tempImg.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

function initCanvas() {
  const container = canvas.parentElement;
  scale = container.clientWidth / img.width;
  const finalW = img.width * scale;
  const finalH = img.height * scale;
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = finalW * dpr;
  canvas.height = finalH * dpr;
  canvas.style.width = finalW + "px";
  canvas.style.height = finalH + "px";
  points = [];
  updateUI();
  draw();
}

// === 2. LÓGICA DE DIBUJO (PROGRESIVO) ===
function draw() {
  if (!img.src) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);

  if (points.length >= 2) {
    const p1 = points[0], p2 = points[1];
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = 10000;

    // Hilgenreiner (Azul)
    ctx.beginPath();
    ctx.moveTo(p1.x - len, p1.y - (len * dy / dx));
    ctx.lineTo(p1.x + len, p1.y + (len * dy / dx));
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    const drawPerp = (p, color) => {
      const px = -dy, py = dx;
      ctx.beginPath();
      ctx.moveTo(p.x - px * len, p.y - py * len);
      ctx.lineTo(p.x + px * len, p.y + py * len);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
    };

    // Perkins (Verde) y Cabeza (Amarillo) - Progresivos
    if (points.length >= 3) drawPerp(points[2], "green");
    if (points.length >= 4) drawPerp(points[3], "green");
    if (points.length >= 5) drawPerp(points[4], "yellow");
    if (points.length >= 6) drawPerp(points[5], "yellow");
    if (points.length >= 7) drawPerp(points[6], "yellow");
    if (points.length >= 8) drawPerp(points[7], "yellow");
  }

  points.forEach(p => drawMarker(p, "#00ff00"));
  if (currentPoint) {
    drawMarker(currentPoint, "yellow");
    drawMagnifier(currentPoint);
  }
}

function drawMarker(p, color) {
  const s = 8 / scale;
  ctx.beginPath();
  ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
  ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / scale;
  ctx.stroke();
}

function drawMagnifier(p) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  const posX = p.x * scale * dpr;
  const posY = p.y * scale * dpr;
  const lupaY = posY - (LUPA_OFFSET * dpr);
  const r = LUPA_RADIO * dpr;

  ctx.beginPath();
  ctx.arc(posX, lupaY, r, 0, Math.PI * 2);
  ctx.fillStyle = "black"; ctx.fill();
  ctx.strokeStyle = "white"; ctx.lineWidth = 3 * dpr; ctx.stroke();
  ctx.clip();

  const zoom = 2.5;
  ctx.drawImage(img, 
    p.x - (LUPA_RADIO/scale)/zoom, p.y - (LUPA_RADIO/scale)/zoom, 
    (LUPA_RADIO*2/scale)/zoom, (LUPA_RADIO*2/scale)/zoom, 
    posX - r, lupaY - r, r * 2, r * 2
  );

  ctx.beginPath();
  ctx.moveTo(posX - 20, lupaY); ctx.lineTo(posX + 20, lupaY);
  ctx.moveTo(posX, lupaY - 20); ctx.lineTo(posX, lupaY + 20);
  ctx.strokeStyle = "red"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

// === 3. EVENTOS TOUCH ===
function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  return { x: (t.clientX - rect.left) / scale, y: (t.clientY - rect.top) / scale };
}

canvas.addEventListener("touchstart", e => {
  if (points.length >= labels.length || !img.src) return;
  e.preventDefault();
  currentPoint = getTouchPos(e);
  draw();
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  if (!currentPoint) return;
  e.preventDefault();
  currentPoint = getTouchPos(e);
  draw();
}, { passive: false });

canvas.addEventListener("touchend", () => {
  if (!currentPoint) return;
  points.push(currentPoint);
  currentPoint = null;
  updateUI();
  if (points.length === labels.length) calculatePM();
  draw();
});

// === 4. CÁLCULO VECTORIAL (Resistente a inclinación) ===
function calculatePM() {
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const mag = Math.hypot(dx, dy);
  const ux = dx / mag, uy = dy / mag;

  const proj = p => p.x * ux + p.y * uy;
  const center = (proj(points[0]) + proj(points[1])) / 2;

  const getPM = (pIdx, latIdx, medIdx) => {
    const per = proj(points[pIdx]);
    const a = proj(points[latIdx]), b = proj(points[medIdx]);
    const lat = Math.abs(a - center) > Math.abs(b - center) ? a : b;
    const med = lat === a ? b : a;
    return (Math.abs(lat - per) / Math.abs(lat - med)) * 100;
  };

  const pmD = getPM(2, 4, 5);
  const pmI = getPM(3, 6, 7);
  
  output.innerHTML = `<strong>DERECHA:</strong> ${pmD.toFixed(1)}% | <strong>IZQUIERDA:</strong> ${pmI.toFixed(1)}%`;
}

function updateUI() {
  instruction.textContent = points.length < labels.length ? "MARCAR: " + labels[points.length] : "✓ MEDICIÓN COMPLETA";
}

undoBtn.onclick = () => { if (points.length > 0) { points.pop(); output.innerHTML = ""; updateUI(); draw(); } };
resetBtn.onclick = () => { if (confirm("¿Reiniciar toda la medición?")) location.reload(); };