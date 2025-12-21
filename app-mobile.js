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

// === 1. CARGA Y PROCESAMIENTO DE IMAGEN (Optimizado para Cámara) ===
imageInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      // Reducimos dimensiones si la foto es masiva (evita errores de memoria en móvil)
      const MAX_SIZE = 1200;
      let w = tempImg.width;
      let h = tempImg.height;
      const ratio = w / h;

      if (w > h && w > MAX_SIZE) {
        w = MAX_SIZE; h = w / ratio;
      } else if (h > MAX_SIZE) {
        h = MAX_SIZE; w = h * ratio;
      }

      // Canvas oculto para re-escalar la foto
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

// === 2. CONFIGURACIÓN DEL CANVAS (Proporciones estrictas) ===
function initCanvas() {
  const container = canvas.parentElement;
  const containerWidth = container.clientWidth;
  
  // Escala única basada en ancho para mantener relación de aspecto
  scale = containerWidth / img.width;

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

// === 3. LÓGICA DE DIBUJO ===
function draw() {
  if (!img.src) return;
  const dpr = window.devicePixelRatio || 1;
  
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);

  // --- DIBUJO DE LÍNEAS (Igual que Desktop) ---
  if (points.length >= 2) {
    const p1 = points[0];
    const p2 = points[1];

    // 1. Línea de Hilgenreiner (Horizontal entre trirradiados)
    ctx.beginPath();
    // Usamos un valor fijo grande (5000) para asegurar que cruce toda la imagen
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    ctx.moveTo(p1.x - 5000, p1.y - (5000 * dy / dx));
    ctx.lineTo(p1.x + 5000, p1.y + (5000 * dy / dx));
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2 / scale; // Un poco más gruesa para verla bien
    ctx.stroke();

    // Función para líneas perpendiculares (Perkins y Cabeza)
    const drawPerp = (p, color) => {
      if (dx === 0) return; // Evitar error división por cero
      const m_perp = -dx / dy; 
      // Si la línea es casi horizontal, la perpendicular es casi vertical
      ctx.beginPath();
      if (Math.abs(dy) < 0.001) { // Caso Hilgenreiner perfectamente horizontal
        ctx.moveTo(p.x, p.y - 5000);
        ctx.lineTo(p.x, p.y + 5000);
      } else {
        const factor = 5000;
        ctx.moveTo(p.x - factor / Math.sqrt(1 + m_perp * m_perp), p.y - m_perp * (factor / Math.sqrt(1 + m_perp * m_perp)));
        ctx.lineTo(p.x + factor / Math.sqrt(1 + m_perp * m_perp), p.y + m_perp * (factor / Math.sqrt(1 + m_perp * m_perp)));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    };

    // 2. Perkins (Verde) - Aparecen tras el punto 4
    if (points.length >= 4) {
      drawPerp(points[2], "green");
      drawPerp(points[3], "green");
    }

    // 3. Bordes Cabeza (Amarillo) - Aparecen al completar los 8 puntos
    if (points.length >= 8) {
      drawPerp(points[4], "yellow");
      drawPerp(points[5], "yellow");
      drawPerp(points[6], "yellow");
      drawPerp(points[7], "yellow");
    }
  }

  // --- DIBUJO DE CRUCES Y LUPA ---
  points.forEach(p => drawMarker(p, "#00ff00"));

  if (currentPoint) {
    drawMarker(currentPoint, "yellow");
    drawMagnifier(currentPoint);
  }
}

function drawMarker(p, color) {
  const s = 6 / scale; // Tamaño visual constante independientemente del zoom
  ctx.beginPath();
  ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
  ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 / scale;
  ctx.stroke();
}

function drawMagnifier(p) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset para dibujo nítido de lupa
  
  const dpr = window.devicePixelRatio || 1;
  const posX = p.x * scale * dpr;
  const posY = p.y * scale * dpr;
  const lupaY = posY - (LUPA_OFFSET * dpr);

  // Círculo de la lupa
  ctx.beginPath();
  ctx.arc(posX, lupaY, LUPA_RADIO * dpr, 0, Math.PI * 2);
  ctx.fillStyle = "black";
  ctx.fill();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3 * dpr;
  ctx.stroke();
  ctx.clip();

  // Contenido de la lupa (Zoom 2.5x)
  const zoom = 2.5;
  const r = LUPA_RADIO * dpr;
  ctx.drawImage(
    img,
    p.x - (LUPA_RADIO / scale) / zoom, p.y - (LUPA_RADIO / scale) / zoom,
    (LUPA_RADIO * 2 / scale) / zoom, (LUPA_RADIO * 2 / scale) / zoom,
    posX - r, lupaY - r,
    r * 2, r * 2
  );

  // Cruz central de la lupa
  ctx.beginPath();
  ctx.moveTo(posX - 20, lupaY); ctx.lineTo(posX + 20, lupaY);
  ctx.moveTo(posX, lupaY - 20); ctx.lineTo(posX, lupaY + 20);
  ctx.strokeStyle = "red";
  ctx.stroke();
  ctx.restore();
}

// === 4. GESTIÓN DE EVENTOS TOUCH ===
function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  return {
    x: (t.clientX - rect.left) / scale,
    y: (t.clientY - rect.top) / scale
  };
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

// === 5. INTERFAZ Y CÁLCULOS ===
function updateUI() {
  if (points.length < labels.length) {
    instruction.textContent = "MARCAR: " + labels[points.length];
  } else {
    instruction.textContent = "✓ MEDICIÓN COMPLETA";
  }
}

function calculatePM() {
  const p = points;
  // Cálculo de Porcentaje de Migración de Reimers
  // Proyectamos las distancias en el eje X de la imagen original
  const pmD = ((p[4].x - p[2].x) / (p[4].x - p[5].x)) * 100;
  const pmI = ((p[3].x - p[6].x) / (p[7].x - p[6].x)) * 100;
  
  output.innerHTML = `
    <strong>DERECHA:</strong> ${pmD.toFixed(1)}% <br>
    <strong>IZQUIERDA:</strong> ${pmI.toFixed(1)}%
  `;
}

// Controles
undoBtn.onclick = () => {
  if (points.length > 0) {
    points.pop();
    output.innerHTML = "";
    updateUI();
    draw();
  }
};

resetBtn.onclick = () => {
  if (confirm("¿Reiniciar toda la medición?")) {
    location.reload();
  }
};