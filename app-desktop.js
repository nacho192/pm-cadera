const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imageInput = document.getElementById("imageInput");
const instruction = document.getElementById("instruction");
const output = document.getElementById("output");
const resetBtn = document.getElementById("resetBtn");

let img = new Image();
let points = [];

const CROSS_SIZE_DESKTOP = 5; // Cruces escritorio
const LINE_WIDTH_DESKTOP = 0.5;

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

function updateInstruction() {
  if (points.length < labels.length) {
    instruction.textContent = "Marcar: " + labels[points.length];
    instruction.style.color = "#0066cc";
  } else {
    instruction.textContent = "Medición completa";
  }
}

// === CARGAR IMAGEN ===
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

// === CLICK DESKTOP ===
canvas.addEventListener("click", e => {
  if (points.length >= labels.length) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scale;
  const y = (e.clientY - rect.top) / scale;

  points.push({ x, y, size: CROSS_SIZE_DESKTOP });
  updateInstruction();
  draw();

  if (points.length === labels.length) {
    calculatePM();
  }
});

// === DIBUJAR ===
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(img, 0, 0);

  // Cruces escritorio
  points.forEach(p => {
    ctx.beginPath();
    ctx.moveTo(p.x - CROSS_SIZE_DESKTOP, p.y);
    ctx.lineTo(p.x + CROSS_SIZE_DESKTOP, p.y);
    ctx.moveTo(p.x, p.y - CROSS_SIZE_DESKTOP);
    ctx.lineTo(p.x, p.y + CROSS_SIZE_DESKTOP);
    ctx.strokeStyle = "red";
    ctx.lineWidth = LINE_WIDTH_DESKTOP;
    ctx.stroke();
  });

  // --- Líneas Hilgenreiner y perpendiculares ---
  if (points.length >= 2) {
    const p1 = points[0];
    const p2 = points[1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // Línea de Hilgenreiner extendida
    const factor = 10000;
    const x0 = p1.x - dx*factor;
    const y0 = p1.y - dy*factor;
    const x1 = p1.x + dx*factor;
    const y1 = p1.y + dy*factor;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = "blue";
    ctx.lineWidth = LINE_WIDTH_DESKTOP;
    ctx.stroke();

    // Función para dibujar líneas perpendiculares
    const drawPerpLine = (point, color) => {
      const m_perp = dy !== 0 ? -dx/dy : 0;
      const len = 10000;
      const x0p = point.x - len / Math.sqrt(1 + m_perp*m_perp);
      const y0p = point.y - m_perp * (len / Math.sqrt(1 + m_perp*m_perp));
      const x1p = point.x + len / Math.sqrt(1 + m_perp*m_perp);
      const y1p = point.y + m_perp * (len / Math.sqrt(1 + m_perp*m_perp));

      ctx.beginPath();
      ctx.moveTo(x0p, y0p);
      ctx.lineTo(x1p, y1p);
      ctx.strokeStyle = color;
      ctx.lineWidth = LINE_WIDTH_DESKTOP;
      ctx.stroke();
    };

    // Perkins
    if (points.length >= 4) {
      drawPerpLine(points[2], "green");
      drawPerpLine(points[3], "green");
    }

    // Cabezas femorales
    if (points.length >= 8) {
      for (let i=4; i<=7; i++) {
        drawPerpLine(points[i], "yellow");
      }
    }
  }
}

// === CALCULAR PM ===
function calculatePM() {
  const latR = points[4].x;
  const medR = points[5].x;
  const perkinsR = points[2].x;

  const latL = points[6].x;
  const medL = points[7].x;
  const perkinsL = points[3].x;

  const pmR = ((latR - perkinsR)/(latR - medR))*100;
  const pmL = ((perkinsL - latL)/(medL - latL))*100;

  output.textContent = `PM Derecho: ${pmR.toFixed(1)}% | PM Izquierdo: ${pmL.toFixed(1)}%`;
}

// === REINICIAR ===
function resetAll() {
  points = [];
  output.textContent = "";
  updateInstruction();
  draw();
}

resetBtn.addEventListener("click", resetAll);

// Inicializar instrucción
updateInstruction();

// Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('Service Worker registrado.', reg))
      .catch(err => console.log('Service Worker fallo:', err));
  });
}
