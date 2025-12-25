// === Elementos del DOM ===
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imageInput = document.getElementById("imageInput"); // original
const cameraInput = document.getElementById("cameraInput"); // NUEVO
const fileInput = document.getElementById("fileInput");     // NUEVO
const instruction = document.getElementById("instruction");
const output = document.getElementById("output");
const resetBtn = document.getElementById("resetBtn");
const undoBtn = document.getElementById("undoBtn");

// === Estado de la Aplicación ===
let img = new Image();
let points = [];
let draggingIdx = -1; 
let isDraggingLine = false;
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

// === 1. CARGA DE IMAGEN (LÓGICA ORIGINAL, SIN CAMBIOS) ===
function processImageFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      const MAX_SIZE = 1200;
      let w = tempImg.width, h = tempImg.height;
      const ratio = w / h;

      if (w > h && w > MAX_SIZE) { 
        w = MAX_SIZE; 
        h = w / ratio; 
      } else if (h > MAX_SIZE) { 
        h = MAX_SIZE; 
        w = h * ratio; 
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
}

// === LISTENER ORIGINAL (SE MANTIENE) ===
imageInput?.addEventListener("change", e => {
  processImageFile(e.target.files[0]);
});

// === NUEVOS LISTENERS (ÚNICA ADICIÓN REAL) ===
cameraInput?.addEventListener("change", e => {
  processImageFile(e.target.files[0]);
});

fileInput?.addEventListener("change", e => {
  processImageFile(e.target.files[0]);
});

// === 2. INICIALIZACIÓN CANVAS (ORIGINAL) ===
function initCanvas() {
  const container = canvas.parentElement;
  scale = container.clientWidth / img.width;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = (img.width * scale) * dpr;
  canvas.height = (img.height * scale) * dpr;
  canvas.style.width = (img.width * scale) + "px";
  canvas.style.height = (img.height * scale) + "px";

  points = [];
  updateUI();
  draw();
}

// === 3. EVENTOS TÁCTILES (ORIGINAL COMPLETO) ===
function getTouchPos(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) / scale,
    y: (touch.clientY - rect.top) / scale
  };
}

canvas.addEventListener("touchstart", e => {
  if (!img.src) return;
  e.preventDefault();

  const pos = getTouchPos(e.touches[0]);
  const hitRadius = 35 / scale;

  draggingIdx = points.findIndex(
    p => Math.hypot(p.x - pos.x, p.y - pos.y) < hitRadius
  );

  if (draggingIdx === -1 && points.length === 8) {
    for (let i = 2; i < 8; i++) {
      if (Math.abs(pos.x - points[i].x) < hitRadius) {
        draggingIdx = i;
        isDraggingLine = true;
        break;
      }
    }
  }

  if (draggingIdx === -1 && points.length < labels.length) {
    points.push(pos);
    draggingIdx = points.length - 1;
  }

  if (draggingIdx !== -1) {
    currentPoint = points[draggingIdx];
    updateUI();
    draw();
  }
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  if (draggingIdx === -1) return;
  e.preventDefault();

  const pos = getTouchPos(e.touches[0]);

  if (isDraggingLine || draggingIdx >= 2) {
    points[draggingIdx].x = pos.x;
  } else {
    points[draggingIdx] = pos;
  }

  currentPoint = points[draggingIdx];
  draw();
}, { passive: false });

canvas.addEventListener("touchend", () => {
  if (points.length === labels.length) calculatePM();
  draggingIdx = -1;
  isDraggingLine = false;
  currentPoint = null;
  draw();
});

// === 4. RENDER MÉDICO (ORIGINAL ÍNTEGRO) ===
function renderMedicalLines(targetCtx, internalScale) {
  if (points.length < 2) return;

  const p1 = points[0], p2 = points[1];
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = 10000;

  targetCtx.beginPath();
  targetCtx.moveTo(p1.x - dx * len, p1.y - dy * len);
  targetCtx.lineTo(p1.x + dx * len, p1.y + dy * len);
  targetCtx.strokeStyle = "#00aaff";
  targetCtx.lineWidth = (2 / scale) / internalScale;
  targetCtx.stroke();

  const drawPerp = (p, color) => {
    const px = -dy, py = dx;
    targetCtx.beginPath();
    targetCtx.moveTo(p.x - px * len, p.y - py * len);
    targetCtx.lineTo(p.x + px * len, p.y + py * len);
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = (2 / scale) / internalScale;
    targetCtx.stroke();
  };

  if (points.length >= 3) drawPerp(points[2], "#00ff44");
  if (points.length >= 4) drawPerp(points[3], "#00ff44");
  [4,5,6,7].forEach(i => { if(points[i]) drawPerp(points[i], "yellow"); });
}

function draw() {
  if (!img.src) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);

  renderMedicalLines(ctx, 1);
  points.forEach((p, i) =>
    drawMarker(p, i === draggingIdx ? "yellow" : "#00ff00")
  );

  if (currentPoint) drawMagnifier(currentPoint);
}

function drawMarker(p, color) {
  const s = 12 / scale;
  ctx.beginPath();
  ctx.moveTo(p.x - s, p.y);
  ctx.lineTo(p.x + s, p.y);
  ctx.moveTo(p.x, p.y - s);
  ctx.lineTo(p.x, p.y + s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5 / scale;
  ctx.stroke();
}

function drawMagnifier(p) {
  const dpr = window.devicePixelRatio || 1;
  const zoom = 2.5;
  const r = LUPA_RADIO * dpr;

  const posX = p.x * scale * dpr;
  const posY = p.y * scale * dpr;
  const lupaY = posY - (LUPA_OFFSET * dpr);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.arc(posX, lupaY, r, 0, Math.PI * 2);
  ctx.fillStyle = "black";
  ctx.fill();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3 * dpr;
  ctx.stroke();
  ctx.clip();

  ctx.translate(posX, lupaY);
  ctx.scale(zoom * scale * dpr, zoom * scale * dpr);
  ctx.translate(-p.x, -p.y);
  ctx.drawImage(img, 0, 0);

  renderMedicalLines(ctx, zoom);
  ctx.restore();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(posX - 15, lupaY);
  ctx.lineTo(posX + 15, lupaY);
  ctx.moveTo(posX, lupaY - 15);
  ctx.lineTo(posX, lupaY + 15);
  ctx.stroke();
  ctx.restore();
}

// === 5. CÁLCULO PM (ORIGINAL) ===
function calculatePM() {
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) return;

  const ux = dx / mag;
  const uy = dy / mag;
  const proj = p => p.x * ux + p.y * uy;
  const center = (proj(points[0]) + proj(points[1])) / 2;

  const pmR = (Math.abs(
    Math.max(proj(points[4]), proj(points[5])) - proj(points[2])
  ) / Math.abs(proj(points[4]) - proj(points[5]))) * 100;

  const pmL = (Math.abs(
    Math.max(proj(points[6]), proj(points[7])) - proj(points[3])
  ) / Math.abs(proj(points[6]) - proj(points[7]))) * 100;

  output.innerHTML = `<strong>D:</strong> ${pmR.toFixed(1)}% | <strong>I:</strong> ${pmL.toFixed(1)}%`;
}

function updateUI() {
  instruction.textContent =
    points.length < labels.length
      ? "MARCAR: " + labels[points.length]
      : "✓ DESLICE LÍNEAS PARA AJUSTAR";
}

undoBtn.onclick = () => {
  points.pop();
  output.innerHTML = "";
  updateUI();
  draw();
};

resetBtn.onclick = () => {
  if (confirm("¿Reiniciar?")) {
    points = [];
    output.innerHTML = "";
    updateUI();
    draw();
  }
};
