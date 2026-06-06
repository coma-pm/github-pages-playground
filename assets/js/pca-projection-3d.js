const canvas = document.getElementById("plotCanvas");
const ctx = canvas.getContext("2d");
const randomizeButton = document.getElementById("randomizeButton");
const optimizeButton = document.getElementById("optimizeButton");
const yawSlider = document.getElementById("yawSlider");
const pitchSlider = document.getElementById("pitchSlider");
const yawReadout = document.getElementById("yawReadout");
const pitchReadout = document.getElementById("pitchReadout");
const varianceReadout = document.getElementById("varianceReadout");

const state = {
  points: [],
  normal: normalFromAngles(Number(yawSlider.value), Number(pitchSlider.value)),
  animationId: null,
  devicePixelRatio: 1,
  plotScale: 1,
};

const POINT_COUNT = 42;
const WORLD_PADDING = 1.55;
const PLANE_HALF_SIZE = 4.2;
const OPTIMIZE_DURATION_MS = 1200;
const CAMERA = {
  x: normalize3({ x: 0.82, y: 0, z: -0.58 }),
  y: normalize3({ x: -0.28, y: 0.88, z: -0.39 }),
};

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function normalizeDegrees(deg) {
  return ((deg % 360) + 360) % 360;
}

function clampPitch(deg) {
  return Math.min(89, Math.max(-89, deg));
}

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function add3(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub3(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale3(v, scalar) {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function length3(v) {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize3(v) {
  const length = length3(v) || 1;
  return scale3(v, 1 / length);
}

function normalFromAngles(yawDeg, pitchDeg) {
  const yaw = degToRad(yawDeg);
  const pitch = degToRad(clampPitch(pitchDeg));
  const horizontal = Math.cos(pitch);

  return normalize3({
    x: horizontal * Math.cos(yaw),
    y: Math.sin(pitch),
    z: horizontal * Math.sin(yaw),
  });
}

function anglesFromNormal(normal) {
  return {
    yaw: normalizeDegrees(radToDeg(Math.atan2(normal.z, normal.x))),
    pitch: clampPitch(radToDeg(Math.asin(Math.max(-1, Math.min(1, normal.y))))),
  };
}

function planeBasis(normal) {
  const fallback = Math.abs(normal.y) > 0.92 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const u = normalize3(cross3(fallback, normal));
  const v = normalize3(cross3(normal, u));
  return { u, v };
}

function projectToPlane(point, normal) {
  return sub3(point, scale3(normal, dot3(point, normal)));
}

function generateCorrelatedGaussianPoints() {
  const axes = randomOrthonormalBasis();
  const majorStd = 1.6 + Math.random() * 1.1;
  const middleStd = 0.72 + Math.random() * 0.65;
  const minorStd = 0.18 + Math.random() * 0.36;

  const rawPoints = Array.from({ length: POINT_COUNT }, () => {
    const major = scale3(axes.u, gaussianRandom() * majorStd);
    const middle = scale3(axes.v, gaussianRandom() * middleStd);
    const minor = scale3(axes.w, gaussianRandom() * minorStd);
    return add3(add3(major, middle), minor);
  });

  return centerPoints(rawPoints);
}

function randomOrthonormalBasis() {
  const u = normalize3({
    x: gaussianRandom(),
    y: gaussianRandom(),
    z: gaussianRandom(),
  });
  const seed = normalize3({
    x: gaussianRandom(),
    y: gaussianRandom(),
    z: gaussianRandom(),
  });
  const v = normalize3(sub3(seed, scale3(u, dot3(seed, u))));
  const w = normalize3(cross3(u, v));
  return { u, v, w };
}

function centerPoints(points) {
  const mean = points.reduce(
    (acc, point) => add3(acc, point),
    { x: 0, y: 0, z: 0 }
  );
  const centeredMean = scale3(mean, 1 / points.length);
  return points.map((point) => sub3(point, centeredMean));
}

function computeCovariance(points) {
  const cov = points.reduce(
    (acc, point) => {
      acc[0][0] += point.x * point.x;
      acc[0][1] += point.x * point.y;
      acc[0][2] += point.x * point.z;
      acc[1][1] += point.y * point.y;
      acc[1][2] += point.y * point.z;
      acc[2][2] += point.z * point.z;
      return acc;
    },
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]
  );

  for (let row = 0; row < 3; row += 1) {
    for (let col = row; col < 3; col += 1) {
      cov[row][col] /= points.length;
      cov[col][row] = cov[row][col];
    }
  }

  return cov;
}

function principalPlaneNormal(points) {
  const { values, vectors } = jacobiEigen3(computeCovariance(points));
  let smallestIndex = 0;

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[smallestIndex]) {
      smallestIndex = index;
    }
  }

  return normalize3({
    x: vectors[0][smallestIndex],
    y: vectors[1][smallestIndex],
    z: vectors[2][smallestIndex],
  });
}

function jacobiEigen3(matrix) {
  const a = matrix.map((row) => row.slice());
  const vectors = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  for (let iteration = 0; iteration < 24; iteration += 1) {
    let p = 0;
    let q = 1;
    let max = Math.abs(a[p][q]);

    for (let row = 0; row < 3; row += 1) {
      for (let col = row + 1; col < 3; col += 1) {
        const value = Math.abs(a[row][col]);
        if (value > max) {
          max = value;
          p = row;
          q = col;
        }
      }
    }

    if (max < 1e-10) break;

    const angle =
      Math.abs(a[p][p] - a[q][q]) < 1e-10
        ? Math.PI / 4
        : Math.atan2(2 * a[p][q], a[q][q] - a[p][p]) / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    rotateMatrix(a, p, q, cos, sin);
    rotateVectors(vectors, p, q, cos, sin);
  }

  return {
    values: [a[0][0], a[1][1], a[2][2]],
    vectors,
  };
}

function rotateMatrix(a, p, q, cos, sin) {
  const app = a[p][p];
  const aqq = a[q][q];
  const apq = a[p][q];

  a[p][p] = cos * cos * app - 2 * sin * cos * apq + sin * sin * aqq;
  a[q][q] = sin * sin * app + 2 * sin * cos * apq + cos * cos * aqq;
  a[p][q] = 0;
  a[q][p] = 0;

  for (let index = 0; index < 3; index += 1) {
    if (index === p || index === q) continue;

    const aip = a[index][p];
    const aiq = a[index][q];
    a[index][p] = cos * aip - sin * aiq;
    a[p][index] = a[index][p];
    a[index][q] = sin * aip + cos * aiq;
    a[q][index] = a[index][q];
  }
}

function rotateVectors(vectors, p, q, cos, sin) {
  for (let row = 0; row < 3; row += 1) {
    const vip = vectors[row][p];
    const viq = vectors[row][q];
    vectors[row][p] = cos * vip - sin * viq;
    vectors[row][q] = sin * vip + cos * viq;
  }
}

function projectionVariance(points, normal) {
  const originalVariance = totalVariance(points);
  const discardedVariance =
    points.reduce((sum, point) => {
      const projection = dot3(point, normal);
      return sum + projection * projection;
    }, 0) / points.length;

  return Math.max(0, originalVariance - discardedVariance);
}

function totalVariance(points) {
  return (
    points.reduce((sum, point) => sum + dot3(point, point), 0) / points.length
  );
}

function updateReadouts() {
  const angles = anglesFromNormal(state.normal);
  yawSlider.value = angles.yaw.toFixed(1);
  pitchSlider.value = angles.pitch.toFixed(1);
  yawReadout.textContent = `${Math.round(angles.yaw)}°`;
  pitchReadout.textContent = `${Math.round(angles.pitch)}°`;
  varianceReadout.textContent = `VAR: ${projectionVariance(
    state.points,
    state.normal
  ).toFixed(2)}`;
}

function resizeCanvas() {
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
    return Math.max(max, Math.abs(toCamera(point).x), Math.abs(toCamera(point).y));
  }, 1);
  return (Math.min(width, height) / 2) * (1 / (maxAbs * WORLD_PADDING));
}

function toCamera(point) {
  return {
    x: dot3(point, CAMERA.x),
    y: dot3(point, CAMERA.y),
  };
}

function worldToScreen(point) {
  const rect = canvas.getBoundingClientRect();
  const projected = toCamera(point);
  return {
    x: rect.width / 2 + projected.x * state.plotScale,
    y: rect.height / 2 - projected.y * state.plotScale,
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

function drawPolygon(points, fillStyle, strokeStyle) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawGrid(rect.width, rect.height);

  const { u, v } = planeBasis(state.normal);
  const planeCorners = [
    add3(scale3(u, -PLANE_HALF_SIZE), scale3(v, -PLANE_HALF_SIZE)),
    add3(scale3(u, PLANE_HALF_SIZE), scale3(v, -PLANE_HALF_SIZE)),
    add3(scale3(u, PLANE_HALF_SIZE), scale3(v, PLANE_HALF_SIZE)),
    add3(scale3(u, -PLANE_HALF_SIZE), scale3(v, PLANE_HALF_SIZE)),
  ].map(worldToScreen);

  drawPolygon(planeCorners, "rgba(255, 250, 240, 0.82)", "rgba(17, 17, 17, 0.62)");

  const marks = state.points
    .flatMap((point) => {
      const projected = projectToPlane(point, state.normal);
      return [
        {
          depth: dot3(projected, state.normal),
          type: "segment",
          from: point,
          to: projected,
        },
        { depth: dot3(projected, state.normal) - 0.01, type: "projected", point: projected },
        { depth: dot3(point, state.normal) + 0.01, type: "point", point },
      ];
    })
    .sort((a, b) => a.depth - b.depth);

  marks.forEach((mark) => {
    if (mark.type === "segment") {
      drawLine(worldToScreen(mark.from), worldToScreen(mark.to), "rgba(80, 80, 80, 0.35)", 1);
      return;
    }

    if (mark.type === "projected") {
      drawCircle(worldToScreen(mark.point), 4.8, "#fffaf0", "#111111", 1.8);
      return;
    }

    drawCircle(worldToScreen(mark.point), 5.8, "#111111");
  });

  updateReadouts();
}

function drawGrid(width, height) {
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
    "rgba(17, 17, 17, 0.16)",
    1.5
  );
  drawLine(
    { x: center.x, y: 0 },
    { x: center.x, y: height },
    "rgba(17, 17, 17, 0.16)",
    1.5
  );
  ctx.restore();
}

function setPlaneFromSliders() {
  state.normal = normalFromAngles(Number(yawSlider.value), Number(pitchSlider.value));
  draw();
}

function cancelOptimization() {
  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  optimizeButton.disabled = false;
}

function chooseClosestNormal(target, current) {
  return dot3(target, current) < 0 ? scale3(target, -1) : target;
}

function slerpNormal(from, to, progress) {
  const alignedTo = chooseClosestNormal(to, from);
  const cosine = Math.max(-1, Math.min(1, dot3(from, alignedTo)));

  if (Math.abs(cosine) > 0.9995) {
    return normalize3(add3(scale3(from, 1 - progress), scale3(alignedTo, progress)));
  }

  const angle = Math.acos(cosine);
  const sinAngle = Math.sin(angle);
  return normalize3(
    add3(
      scale3(from, Math.sin((1 - progress) * angle) / sinAngle),
      scale3(alignedTo, Math.sin(progress * angle) / sinAngle)
    )
  );
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function optimizePlane() {
  cancelOptimization();
  optimizeButton.disabled = true;

  const startNormal = state.normal;
  const targetNormal = principalPlaneNormal(state.points);
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / OPTIMIZE_DURATION_MS);
    state.normal = slerpNormal(startNormal, targetNormal, easeInOutCubic(progress));
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
  state.points = generateCorrelatedGaussianPoints();
  state.plotScale = computePlotScale(
    canvas.getBoundingClientRect().width,
    canvas.getBoundingClientRect().height
  );
  draw();
}

yawSlider.addEventListener("input", () => {
  cancelOptimization();
  setPlaneFromSliders();
});
pitchSlider.addEventListener("input", () => {
  cancelOptimization();
  setPlaneFromSliders();
});
randomizeButton.addEventListener("click", randomizeData);
optimizeButton.addEventListener("click", optimizePlane);
window.addEventListener("resize", resizeCanvas);

state.points = generateCorrelatedGaussianPoints();
resizeCanvas();
