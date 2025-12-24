const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imageInput = document.getElementById("imageInput");
const instruction = document.getElementById("instruction");
const output = document.getElementById("output");
const resetBtn = document.getElementById("resetBtn");
const undoBtn = document.getElementById("undoBtn");
const sizeSlider = document.getElementById("sizeSlider"); // Nuevo: referencia al slider

let img = new Image();
let points = [];
let isDragging = false;
let dragIdx = -1;

// Tamaño inicial obtenido del slider
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

// ================= EVENTO SLIDER =================
sizeSlider.addEventListener("input", () => {
  crossSize = parseInt(sizeSlider.value);
  draw(); // Redibuja instantáneamente al mover el slider
});

// ================= INSTRUCCIONES =================
function updateInstruction() {
  instruction.textContent =
    points.length < labels.length
      ? "Marcar: " + labels[points.length]
      : "Medición completa";
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

  const clickedExisting = points.some(p => Math.hypot(p.x - x, p.y - y) < 10 / scale);

  if (!clickedExisting) {
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

if (undoBtn) undoBtn.addEventListener("click", undo);

// ================= DIBUJO =================
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  
  if (img.src) ctx.drawImage(img, 0, 0);

  // Grosor de línea dinámico basado en el slider (mínimo 1.5)
  const dynamicLineWidth = Math.max(1.5, crossSize / 4);

  // Cruces rojas con tamaño del slider
  points.forEach(p => {
    ctx.beginPath();
    const s = crossSize / scale; 
    ctx.moveTo(p.x - s, p.y);
    ctx.lineTo(p.x + s, p.y);
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x, p.y + s);
    ctx.strokeStyle = "red";
    ctx.lineWidth = dynamicLineWidth / scale;
    ctx.stroke();
  });

  if (points.length >= 2) {
    const h1 = points[0], h2 = points[1];
    const dx = h2.x - h1.x, dy = h2.y - h1.y;
    const len = 10000;

    // Hilgenreiner (Azul)
    ctx.beginPath();
    ctx.moveTo(h1.x - dx * len, h1.y - dy * len);
    ctx.lineTo(h1.x + dx * len, h1.y + dy * len);
    ctx.strokeStyle = "blue";
    ctx.lineWidth = dynamicLineWidth / scale;
    ctx.stroke();

    const drawVerticalLine = (p, color) => {
      const px = -dy, py = dx;
      ctx.beginPath();
      ctx.moveTo(p.x - px * len, p.y - py * len);
      ctx.lineTo(p.x + px * len, p.y + py * len);
      ctx.strokeStyle = color;
      ctx.lineWidth = dynamicLineWidth / scale;
      ctx.stroke();
    };

    // Líneas de Perkins (Verde) y Cabeza (Amarillo)
    if (points.length >= 3) drawVerticalLine(points[2], "green");
    if (points.length >= 4) drawVerticalLine(points[3], "green");
    if (points.length >= 5) drawVerticalLine(points[4], "yellow");
    if (points.length >= 6) drawVerticalLine(points[5], "yellow");
    if (points.length >= 7) drawVerticalLine(points[6], "yellow");
    if (points.length >= 8) drawVerticalLine(points[7], "yellow");
  }
}

// ================= CÁLCULOS =================
function calculatePM() {
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const mag = Math.hypot(dx, dy);
  const ux = dx / mag, uy = dy / mag;

  const proj = p => p.x * ux + p.y * uy;
  const center = (proj(points[0]) + proj(points[1])) / 2;

  // Lado Derecho
  const perR = proj(points[2]);
  const aR = proj(points[4]);
  const bR = proj(points[5]);
  const latR = Math.abs(aR - center) > Math.abs(bR - center) ? aR : bR;
  const medR = latR === aR ? bR : aR;
  const pmR = (Math.abs(latR - perR) / Math.abs(latR - medR)) * 100;

  // Lado Izquierdo
  const perL = proj(points[3]);
  const aL = proj(points[6]);
  const bL = proj(points[7]);
  const latL = Math.abs(aL - center) > Math.abs(bL - center) ? aL : bL;
  const medL = latL === aL ? bL : aL;
  const pmL = (Math.abs(latL - perL) / Math.abs(latL - medL)) * 100;

  output.innerHTML = `<b>PM Derecho: ${pmR.toFixed(1)}% | PM Izquierdo: ${pmL.toFixed(1)}%</b>`;
}

function resetAll() {
  points = [];
  output.innerHTML = "";
  updateInstruction();
  draw();
}

resetBtn.addEventListener("click", resetAll);
updateInstruction();