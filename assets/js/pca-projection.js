const canvas = document.getElementById("plotCanvas");
const ctx = canvas.getContext("2d");
const randomizeButton = document.getElementById("randomizeButton");
const optimizeButton = document.getElementById("optimizeButton");
const angleSlider = document.getElementById("angleSlider");
const angleReadout = document.getElementById("angleReadout");
const varianceReadout = document.getElementById("varianceReadout");

// All mutable values live in one place so rendering and controls stay in sync.
const state = {
  points: [],
  angleDeg: Number(angleSlider.value),
  animationId: null,
  devicePixelRatio: 1,
  plotScale: 1,
};

const POINT_COUNT = 34;
const WORLD_PADDING = 1.35;
const AXIS_HALF_LENGTH = 8;
const OPTIMIZE_DURATION_MS = 1100;

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function normalizeAxisDegrees(deg) {
  return ((deg % 180) + 180) % 180;
}

function clampSliderDegrees(deg) {
  return Math.min(180, Math.max(0, deg));
}

function gaussianRandom() {
  // Box-Muller transform: two uniform random numbers into one standard normal.
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateCorrelatedGaussianPoints() {
  // Generate an elongated Gaussian cloud, then rotate it so PCA has a visible target.
  const rotation = Math.random() * Math.PI;
  const majorStd = 1.45 + Math.random() * 1.35;
  const minorStd = 0.28 + Math.random() * 0.62;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const rawPoints = Array.from({ length: POINT_COUNT }, () => {
    const alongMajor = gaussianRandom() * majorStd;
    const alongMinor = gaussianRandom() * minorStd;

    return {
      x: alongMajor * cos - alongMinor * sin,
      y: alongMajor * sin + alongMinor * cos,
    };
  });

  return centerPoints(rawPoints);
}

function centerPoints(points) {
  const mean = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 }
  );

  mean.x /= points.length;
  mean.y /= points.length;

  return points.map((point) => ({
    x: point.x - mean.x,
    y: point.y - mean.y,
  }));
}

function computeCovariance(points) {
  // The generated points are centered, so covariance is the mean outer product.
  const cov = points.reduce(
    (acc, point) => {
      acc.xx += point.x * point.x;
      acc.xy += point.x * point.y;
      acc.yy += point.y * point.y;
      return acc;
    },
    { xx: 0, xy: 0, yy: 0 }
  );

  const divisor = points.length;
  cov.xx /= divisor;
  cov.xy /= divisor;
  cov.yy /= divisor;

  return cov;
}

function principalComponentAngle(points) {
  // Closed-form eigendecomposition for a symmetric 2x2 covariance matrix.
  const { xx, xy, yy } = computeCovariance(points);
  const trace = xx + yy;
  const determinant = xx * yy - xy * xy;
  const discriminant = Math.max(0, trace * trace - 4 * determinant);
  const largestEigenvalue = (trace + Math.sqrt(discriminant)) / 2;

  // For a 2x2 covariance matrix, this vector lies in the eigenspace of lambda.
  let vx = xy;
  let vy = largestEigenvalue - xx;

  if (Math.hypot(vx, vy) < 1e-8) {
    vx = largestEigenvalue - yy;
    vy = xy;
  }

  if (Math.hypot(vx, vy) < 1e-8) {
    vx = 1;
    vy = 0;
  }

  return normalizeAxisDegrees(radToDeg(Math.atan2(vy, vx)));
}

function projectionVariance(points, angleDeg) {
  // Project each 2D point onto the unit axis u = (cos theta, sin theta).
  const theta = degToRad(angleDeg);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const projections = points.map((point) => point.x * ux + point.y * uy);
  const mean =
    projections.reduce((sum, projection) => sum + projection, 0) /
    projections.length;

  return (
    projections.reduce((sum, projection) => {
      const centered = projection - mean;
      return sum + centered * centered;
    }, 0) / projections.length
  );
}

function updateReadouts() {
  angleSlider.value = state.angleDeg.toFixed(1);
  angleReadout.textContent = `${Math.round(state.angleDeg)}°`;
  varianceReadout.textContent = `VAR: ${projectionVariance(
    state.points,
    state.angleDeg
  ).toFixed(2)}`;
}

function resizeCanvas() {
  // Match canvas backing pixels to CSS pixels for crisp lines on high-DPI screens.
  const rect = canvas.getBoundingClientRect();
  state.devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * state.devicePixelRatio);
  canvas.height = Math.round(rect.height * state.devicePixelRatio);
  ctx.setTransform(
    state.devicePixelRatio,
    0,
    0,
    state.devicePixelRatio,
    0,
    0
  );
  state.plotScale = computePlotScale(rect.width, rect.height);
  draw();
}

function computePlotScale(width, height) {
  const maxAbs = state.points.reduce((max, point) => {
    return Math.max(max, Math.abs(point.x), Math.abs(point.y));
  }, 1);
  return (Math.min(width, height) / 2) * (1 / (maxAbs * WORLD_PADDING));
}

function worldToScreen(point) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.width / 2 + point.x * state.plotScale,
    y: rect.height / 2 - point.y * state.plotScale,
  };
}

function drawLine(from, to, strokeStyle, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawCircle(center, radius, fillStyle, strokeStyle, lineWidth = 1) {
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillStyle;
  ctx.fill();

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const theta = degToRad(state.angleDeg);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const axisStart = worldToScreen({
    x: -ux * AXIS_HALF_LENGTH,
    y: -uy * AXIS_HALF_LENGTH,
  });
  const axisEnd = worldToScreen({
    x: ux * AXIS_HALF_LENGTH,
    y: uy * AXIS_HALF_LENGTH,
  });

  drawGrid(rect.width, rect.height);

  // Projection segments are drawn first so points remain visually dominant.
  state.points.forEach((point) => {
    const projectionScalar = point.x * ux + point.y * uy;
    const projected = {
      x: projectionScalar * ux,
      y: projectionScalar * uy,
    };

    drawLine(
      worldToScreen(point),
      worldToScreen(projected),
      "rgba(80, 80, 80, 0.38)",
      1
    );
  });

  // The current one-dimensional subspace: every point is projected onto this line.
  drawLine(axisStart, axisEnd, "#111111", 5);

  state.points.forEach((point) => {
    const projectionScalar = point.x * ux + point.y * uy;
    const projected = {
      x: projectionScalar * ux,
      y: projectionScalar * uy,
    };

    drawCircle(worldToScreen(projected), 5.2, "#fffaf0", "#111111", 2);
  });

  state.points.forEach((point) => {
    drawCircle(worldToScreen(point), 5.8, "#111111");
  });

  updateReadouts();
}

function drawGrid(width, height) {
  // A faint coordinate grid gives the origin context without competing with PCA marks.
  const center = { x: width / 2, y: height / 2 };
  const gridStep = Math.max(42, state.plotScale);

  ctx.save();
  ctx.strokeStyle = "rgba(17, 17, 17, 0.08)";
  ctx.lineWidth = 1;

  for (let x = center.x % gridStep; x < width; x += gridStep) {
    drawLine({ x, y: 0 }, { x, y: height }, ctx.strokeStyle, 1);
  }

  for (let y = center.y % gridStep; y < height; y += gridStep) {
    drawLine({ x: 0, y }, { x: width, y }, ctx.strokeStyle, 1);
  }

  drawLine(
    { x: 0, y: center.y },
    { x: width, y: center.y },
    "rgba(17, 17, 17, 0.18)",
    1.5
  );
  drawLine(
    { x: center.x, y: 0 },
    { x: center.x, y: height },
    "rgba(17, 17, 17, 0.18)",
    1.5
  );
  ctx.restore();
}

function setAngle(angleDeg) {
  state.angleDeg = clampSliderDegrees(angleDeg);
  draw();
}

function cancelOptimization() {
  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  optimizeButton.disabled = false;
}

function shortestAxisDelta(fromDeg, toDeg) {
  // PCA axes are directionless, so rotating +180 degrees returns the same axis.
  let delta = normalizeAxisDegrees(toDeg) - normalizeAxisDegrees(fromDeg);
  if (delta > 90) delta -= 180;
  if (delta < -90) delta += 180;
  return delta;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function optimizeAxis() {
  cancelOptimization();
  optimizeButton.disabled = true;

  // Find the first principal component, then animate to it along the shortest axis arc.
  const startAngle = state.angleDeg;
  const targetAngle = principalComponentAngle(state.points);
  const delta = shortestAxisDelta(startAngle, targetAngle);
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / OPTIMIZE_DURATION_MS);
    const eased = easeInOutCubic(progress);
    state.angleDeg = normalizeAxisDegrees(startAngle + delta * eased);
    draw();

    if (progress < 1) {
      state.animationId = requestAnimationFrame(tick);
      return;
    }

    state.animationId = null;
    optimizeButton.disabled = false;
  }

  state.animationId = requestAnimationFrame(tick);
}

function randomizeData() {
  cancelOptimization();
  // New data gets a new initial axis so users can rediscover the maximum direction.
  state.points = generateCorrelatedGaussianPoints();
  state.angleDeg = Math.random() * 180;
  state.plotScale = computePlotScale(
    canvas.getBoundingClientRect().width,
    canvas.getBoundingClientRect().height
  );
  draw();
}

angleSlider.addEventListener("input", (event) => {
  cancelOptimization();
  setAngle(Number(event.target.value));
});

randomizeButton.addEventListener("click", randomizeData);
optimizeButton.addEventListener("click", optimizeAxis);
window.addEventListener("resize", resizeCanvas);

state.points = generateCorrelatedGaussianPoints();
resizeCanvas();
