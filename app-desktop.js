const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imageInput = document.getElementById("imageInput");
const instruction = document.getElementById("instruction");
const output = document.getElementById("output");
const resetBtn = document.getElementById("resetBtn");
const undoBtn = document.getElementById("undoBtn");
const sizeSlider = document.getElementById("sizeSlider");

let img = new Image();
let points = [];
let isDragging = false;
let dragIdx = -1;

let crossSize = parseInt(sizeSlider.value) || 8;
let scale = 1;
let baseScale = 1;

const labels = [
  "Cartílago trirradiado derecho",
  "Cartílago trirradiado izquierdo",
  "Borde lateral acetábulo derecho (Perkins)",
  "Borde lateral acetábulo izquierdo (Perkins)",
  "Borde lateral cabeza femoral derecha",
  "Borde medial cabeza femoral derecha",
  "Borde lateral cabeza femoral izquierda",
  "Borde medial cabeza femoral izquierda"
];

// ================= UTILIDADES =================
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ================= SLIDER =================
sizeSlider.addEventListener("input", () => {
  crossSize = parseInt(sizeSlider.value);
  draw();
});

// ================= INSTRUCCIONES =================
function updateInstruction() {
  instruction.textContent =
    points.length < labels.length
      ? "Marcar: " + labels[points.length]
      : "Medición completa (válida solo en pelvis AP sin rotación)";
}

// ================= CARGA IMAGEN =================
imageInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  img.src = URL.createObjectURL(file);
  img.onload = () => {
    const viewer = canvas.parentElement;
    canvas.width = viewer.clientWidth;
    canvas.height = viewer.clientHeight;

    baseScale = Math.min(canvas.width / img.width, canvas.height / img.height);
    scale = baseScale;

    resetAll();
    draw();
  };
});

// ================= GESTIÓN DE PUNTOS =================
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) / scale;
  const mouseY = (e.clientY - rect.top) / scale;

  dragIdx = points.findIndex(p => Math.hypot(p.x - mouseX, p.y - mouseY) < 10 / scale);
  if (dragIdx !== -1) isDragging = true;
});

canvas.addEventListener("mousemove", e => {
  if (!isDragging) return;
  const rect = canvas.getBoundingClientRect();
  points[dragIdx].x = (e.clientX - rect.left) / scale;
  points[dragIdx].y = (e.clientY - rect.top) / scale;
  draw();
  if (points.length === labels.length) calculatePM();
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  dragIdx = -1;
});

canvas.addEventListener("click", e => {
  if (isDragging || points.length >= labels.length) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scale;
  const y = (e.clientY - rect.top) / scale;

  if (!points.some(p => Math.hypot(p.x - x, p.y - y) < 10 / scale)) {
    points.push({ x, y });
    updateInstruction();
    draw();
    if (points.length === labels.length) calculatePM();
  }
});

function undo() {
  if (points.length > 0) {
    points.pop();
    output.innerHTML = "";
    updateInstruction();
    draw();
  }
}

window.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  }
});

undoBtn?.addEventListener("click", undo);

// ================= DIBUJO =================
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  if (img.src) ctx.drawImage(img, 0, 0);

  const lw = Math.max(1.5, crossSize / 4);

  points.forEach(p => {
    const s = crossSize / scale;
    ctx.beginPath();
    ctx.moveTo(p.x - s, p.y);
    ctx.lineTo(p.x + s, p.y);
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x, p.y + s);
    ctx.strokeStyle = "red";
    ctx.lineWidth = lw / scale;
    ctx.stroke();
  });

  if (points.length >= 2) {
    const h1 = points[0], h2 = points[1];
    const dx = h2.x - h1.x, dy = h2.y - h1.y;
    const len = 10000;

    ctx.beginPath();
    ctx.moveTo(h1.x - dx * len, h1.y - dy * len);
    ctx.lineTo(h1.x + dx * len, h1.y + dy * len);
    ctx.strokeStyle = "blue";
    ctx.lineWidth = lw / scale;
    ctx.stroke();

    const drawVertical = (p, color) => {
      const px = -dy, py = dx;
      ctx.beginPath();
      ctx.moveTo(p.x - px * len, p.y - py * len);
      ctx.lineTo(p.x + px * len, p.y + py * len);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw / scale;
      ctx.stroke();
    };

    if (points.length >= 3) drawVertical(points[2], "green");
    if (points.length >= 4) drawVertical(points[3], "green");
    for (let i = 4; i < points.length; i++) drawVertical(points[i], "yellow");
  }
}

// ================= CÁLCULO PM =================
function calculatePM() {
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) return;

  const ux = dx / mag, uy = dy / mag;
  const proj = p => p.x * ux + p.y * uy;
  const center = (proj(points[0]) + proj(points[1])) / 2;

  function computeSide(per, a, b) {
    const lat = Math.abs(a - center) > Math.abs(b - center) ? a : b;
    const med = lat === a ? b : a;
    const denom = Math.abs(lat - med);
    if (denom < 1e-6) return null;
    return clamp((Math.abs(lat - per) / denom) * 100, 0, 100);
  }

  const pmR = computeSide(proj(points[2]), proj(points[4]), proj(points[5]));
  const pmL = computeSide(proj(points[3]), proj(points[6]), proj(points[7]));

  output.innerHTML =
    pmR !== null && pmL !== null
      ? `<b>PM Derecho: ${pmR.toFixed(1)}% | PM Izquierdo: ${pmL.toFixed(1)}%</b>`
      : "<b>Error de marcación: revisar puntos</b>";
}

// ================= RESET =================
function resetAll() {
  points = [];
  output.innerHTML = "";
  updateInstruction();
  draw();
}

resetBtn.addEventListener("click", resetAll);
updateInstruction();
