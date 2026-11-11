(() => {
  "use strict";

  const canvas = document.getElementById("flight-scene");
  const ctx = canvas.getContext("2d");
  const throttleInput = document.getElementById("throttle");
  const startOverlay = document.getElementById("start-overlay");
  const endOverlay = document.getElementById("end-overlay");
  const startButton = document.getElementById("start-button");
  const restartButton = document.getElementById("restart-button");
  const soundButton = document.getElementById("sound-button");
  const width = canvas.width;
  const height = canvas.height;
  const scale = width / 1000;
  const planeScreenX = 300;
  const runwayStart = 4120;
  const runwayEnd = 4780;
  const checkpoints = [
    { x: 680, altitude: 190 },
    { x: 1280, altitude: 270 },
    { x: 1950, altitude: 165 },
    { x: 2700, altitude: 230 },
    { x: 3440, altitude: 145 }
  ];

  const ui = {
    speed: document.getElementById("speed-value"),
    altitude: document.getElementById("altitude-value"),
    climb: document.getElementById("climb-value"),
    speedMeter: document.getElementById("speed-meter"),
    altitudeMeter: document.getElementById("altitude-meter"),
    climbMeter: document.getElementById("climb-meter"),
    throttle: document.getElementById("throttle-value"),
    distance: document.getElementById("distance-readout"),
    checkpoint: document.getElementById("checkpoint-readout"),
    objective: document.getElementById("objective-readout"),
    heading: document.getElementById("heading-readout"),
    session: document.getElementById("session-status"),
    endEyebrow: document.getElementById("end-eyebrow"),
    endTitle: document.getElementById("end-title"),
    endMessage: document.getElementById("end-message")
  };

  const keys = new Set();
  let state;
  let lastFrame = 0;
  let animationId = 0;
  let soundEnabled = false;
  let audioContext;

  function makeState() {
    return {
      phase: "ready",
      x: 0,
      altitude: 36,
      climbRate: 0,
      speed: 59,
      throttle: 62,
      pitch: 0,
      bank: 0,
      passed: new Set(),
      score: 0,
      elapsed: 0
    };
  }

  state = makeState();

  function groundElevation(worldX) {
    if (worldX > runwayStart - 380 && worldX < runwayEnd + 120) return 0;
    return Math.max(0, 18 + Math.sin(worldX * 0.0014) * 11 + Math.sin(worldX * 0.0043 + 1.8) * 6);
  }

  function groundScreenY(worldX, cameraX) {
    const elevation = groundElevation(worldX);
    const runwayZone = worldX >= runwayStart && worldX <= runwayEnd;
    const base = 438 - elevation * 0.86;
    return runwayZone ? 438 : base;
  }

  function planeScreenY() {
    return groundScreenY(state.x, state.x - planeScreenX) - state.altitude * 0.86;
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#75b5d0");
    sky.addColorStop(.58, "#c2e2e8");
    sky.addColorStop(1, "#f1dfbd");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const sun = ctx.createRadialGradient(760, 115, 8, 760, 115, 115);
    sun.addColorStop(0, "rgba(255,244,198,.63)");
    sun.addColorStop(1, "rgba(255,244,198,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(635, 0, 250, 240);
    ctx.fillStyle = "rgba(255,244,204,.9)";
    ctx.beginPath();
    ctx.arc(760, 115, 22, 0, Math.PI * 2);
    ctx.fill();

    drawClouds();
    drawDistantHills();
  }

  function drawClouds() {
    for (let i = 0; i < 9; i++) {
      const baseX = ((i * 181 + 70 - state.x * 0.12) % 1200 + 1200) % 1200 - 100;
      const y = 55 + (i * 71 % 190);
      const size = 0.55 + (i % 3) * .17;
      ctx.fillStyle = `rgba(255,255,255,${.35 + (i % 3) * .1})`;
      ctx.beginPath();
      ctx.ellipse(baseX, y, 35 * size, 12 * size, 0, 0, Math.PI * 2);
      ctx.ellipse(baseX + 16 * size, y - 6 * size, 21 * size, 16 * size, 0, 0, Math.PI * 2);
      ctx.ellipse(baseX + 34 * size, y, 31 * size, 11 * size, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDistantHills() {
    ctx.fillStyle = "#a3c8c0";
    ctx.beginPath();
    ctx.moveTo(0, 342);
    for (let x = 0; x <= width; x += 8) {
      const worldX = x + state.x - planeScreenX;
      const y = 340 + Math.sin(worldX * .0012) * 26 + Math.sin(worldX * .0038) * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(126,174,157,.45)";
    ctx.beginPath();
    ctx.moveTo(0, 378);
    for (let x = 0; x <= width; x += 8) {
      const worldX = x + state.x - planeScreenX;
      ctx.lineTo(x, 375 + Math.sin(worldX * .002 + 2.3) * 19 + Math.sin(worldX * .005) * 9);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain() {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 3) {
      const worldX = state.x + x - planeScreenX;
      ctx.lineTo(x, groundScreenY(worldX, state.x) + 10);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    const ground = ctx.createLinearGradient(0, 410, 0, height);
    ground.addColorStop(0, "#648f78");
    ground.addColorStop(1, "#294d43");
    ctx.fillStyle = ground;
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x <= width; x += 3) {
      const worldX = state.x + x - planeScreenX;
      const y = groundScreenY(worldX, state.x) + 9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#c0d29c";
    ctx.lineWidth = 3;
    ctx.stroke();
    drawRunway();
    drawTrees();
  }

  function drawRunway() {
    const x1 = planeScreenX + runwayStart - state.x;
    const x2 = planeScreenX + runwayEnd - state.x;
    if (x2 < 0 || x1 > width) return;
    ctx.fillStyle = "#505d5e";
    ctx.fillRect(x1, 438, x2 - x1, 23);
    ctx.fillStyle = "#d9d4bb";
    ctx.fillRect(x1, 437, x2 - x1, 2);
    ctx.fillRect(x1, 460, x2 - x1, 2);
    for (let x = Math.max(x1 + 12, 0); x < Math.min(x2 - 12, width); x += 48) {
      ctx.fillRect(x, 448, 25, 2);
    }
    ctx.fillStyle = "#e8d8a0";
    ctx.fillRect(x1 + 5, 430, 3, 10);
    ctx.fillRect(x2 - 8, 430, 3, 10);
    ctx.fillStyle = "rgba(43,70,62,.45)";
    ctx.font = "9px monospace";
    ctx.fillText("09", x1 + 12, 455);
  }

  function drawTrees() {
    for (let worldX = Math.floor((state.x - 420) / 120) * 120; worldX < state.x + 850; worldX += 120) {
      if (worldX > runwayStart - 400 && worldX < runwayEnd + 100) continue;
      const screenX = planeScreenX + worldX - state.x;
      const groundY = groundScreenY(worldX, state.x);
      const size = 0.7 + (Math.sin(worldX * .03) + 1) * .2;
      ctx.fillStyle = "#526e57";
      ctx.fillRect(screenX - 2, groundY - 18 * size, 4, 18 * size);
      ctx.fillStyle = "#3e745b";
      ctx.beginPath();
      ctx.moveTo(screenX, groundY - 47 * size);
      ctx.lineTo(screenX - 13 * size, groundY - 13 * size);
      ctx.lineTo(screenX + 13 * size, groundY - 13 * size);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCheckpoints() {
    checkpoints.forEach((point, index) => {
      if (state.passed.has(index)) return;
      const x = planeScreenX + point.x - state.x;
      const y = groundScreenY(point.x, state.x) - point.altitude * .86;
      if (x < -70 || x > width + 70) return;
      const pulse = 1 + Math.sin(state.elapsed * 3 + index) * .04;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = "#ffe49a";
      ctx.lineWidth = 6;
      ctx.shadowColor = "rgba(255,211,105,.8)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,247,205,.95)";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(index + 1).padStart(2, "0"), 0, 4);
      ctx.restore();
    });
  }

  function drawPlane() {
    const y = planeScreenY();
    ctx.save();
    ctx.translate(planeScreenX, y);
    ctx.rotate(-state.pitch * .018 + state.bank * .06);
    ctx.scale(1.45, 1.45);
    ctx.shadowColor = "rgba(26,52,61,.28)";
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#f3f5e9";
    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.lineTo(15, -4);
    ctx.lineTo(0, -4);
    ctx.lineTo(-8, -20);
    ctx.lineTo(-15, -20);
    ctx.lineTo(-12, -4);
    ctx.lineTo(-28, -3);
    ctx.lineTo(-38, -9);
    ctx.lineTo(-42, -8);
    ctx.lineTo(-38, 0);
    ctx.lineTo(-42, 8);
    ctx.lineTo(-38, 9);
    ctx.lineTo(-28, 3);
    ctx.lineTo(-12, 4);
    ctx.lineTo(-15, 20);
    ctx.lineTo(-8, 20);
    ctx.lineTo(0, 4);
    ctx.lineTo(15, 4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#55c9a5";
    ctx.beginPath();
    ctx.moveTo(17, -2);
    ctx.lineTo(-13, -2);
    ctx.lineTo(-17, 0);
    ctx.lineTo(-13, 2);
    ctx.lineTo(17, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#bed7d6";
    ctx.beginPath();
    ctx.moveTo(8, -3);
    ctx.lineTo(-2, -3);
    ctx.lineTo(-5, -12);
    ctx.lineTo(1, -12);
    ctx.closePath();
    ctx.fill();
    if (state.throttle > 8 && state.phase === "flying") {
      ctx.globalAlpha = Math.min(.65, state.throttle / 130);
      ctx.fillStyle = "#fff3c6";
      ctx.beginPath();
      ctx.moveTo(-42, -2);
      ctx.lineTo(-51 - state.throttle * .09, 0);
      ctx.lineTo(-42, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawSky();
    drawTerrain();
    drawCheckpoints();
    drawPlane();
    if (state.phase === "paused") {
      ctx.fillStyle = "rgba(8,20,29,.35)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#fff";
      ctx.font = "600 24px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", width / 2, height / 2);
    }
  }

  function updateReadouts() {
    const speedKnots = Math.round(state.speed * 1.94384);
    const altitudeFeet = Math.max(0, Math.round(state.altitude * 3.28084));
    const climbFeet = Math.round(state.climbRate * 196.85);
    ui.speed.textContent = speedKnots;
    ui.altitude.textContent = altitudeFeet.toLocaleString("en-US");
    ui.climb.textContent = climbFeet > 0 ? `+${climbFeet}` : climbFeet;
    ui.throttle.textContent = Math.round(state.throttle);
    ui.speedMeter.style.width = `${Math.min(100, speedKnots / 2.2)}%`;
    ui.altitudeMeter.style.width = `${Math.min(100, state.altitude / 4)}%`;
    ui.climbMeter.style.width = `${Math.min(100, Math.abs(climbFeet) / 25)}%`;
    ui.climbMeter.style.background = climbFeet < 0 ? "#f0a27d" : "var(--mint)";
    ui.distance.textContent = `DISTANCE ${(state.x / 1852).toFixed(1)} NM`;
    ui.checkpoint.textContent = `CHECKPOINTS ${state.passed.size} / ${checkpoints.length}`;
    ui.heading.textContent = `HDG ${String(Math.round((90 + state.bank * 2 + 360) % 360)).padStart(3, "0")}°`;
    ui.objective.textContent = state.passed.size === checkpoints.length ? "RUNWAY AHEAD · PREPARE TO LAND" : "FLY THROUGH THE CHECKPOINTS";
    throttleInput.value = String(Math.round(state.throttle));
  }

  function playTone(frequency, duration = .12) {
    if (!soundEnabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext = audioContext || new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(.055, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function finishFlight(landed, message) {
    state.phase = landed ? "landed" : "crashed";
    ui.session.textContent = landed ? "LANDED" : "FLIGHT ENDED";
    ui.endEyebrow.textContent = landed ? "FLIGHT COMPLETE" : "FLIGHT ENDED";
    ui.endTitle.textContent = landed ? "Touchdown." : "Easy does it.";
    ui.endMessage.textContent = message;
    endOverlay.classList.remove("hidden");
    cancelAnimationFrame(animationId);
    draw();
  }

  function update(dt) {
    if (state.phase !== "flying") return;
    state.elapsed += dt;
    if (keys.has("KeyA")) state.throttle = Math.max(0, state.throttle - 28 * dt);
    if (keys.has("KeyD")) state.throttle = Math.min(100, state.throttle + 28 * dt);
    if (keys.has("KeyW") || keys.has("ArrowUp")) state.pitch = Math.min(28, state.pitch + 36 * dt);
    else if (keys.has("KeyS") || keys.has("ArrowDown")) state.pitch = Math.max(-28, state.pitch - 36 * dt);
    else state.pitch *= Math.pow(.35, dt);
    if (keys.has("Space")) state.bank *= Math.pow(.05, dt);

    const throttleRatio = state.throttle / 100;
    const targetSpeed = 35 + throttleRatio * 70;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * .34);
    const targetClimb = state.speed * Math.sin(state.pitch * Math.PI / 180) * .48;
    state.climbRate += (targetClimb - state.climbRate) * Math.min(1, dt * 1.8);
    state.altitude = Math.max(0, Math.min(550, state.altitude + state.climbRate * dt));
    state.x += state.speed * dt;
    state.bank += ((keys.has("KeyW") ? -1 : 0) + (keys.has("KeyS") ? 1 : 0) - state.bank * .8) * dt;
    state.bank = Math.max(-1, Math.min(1, state.bank));

    checkpoints.forEach((point, index) => {
      if (!state.passed.has(index) && Math.abs(state.x - point.x) < 30) {
        if (Math.abs(state.altitude - point.altitude) < 70) {
          state.passed.add(index);
          state.score += 100;
          playTone(740 + index * 75, .2);
        }
      }
    });

    if (state.x >= runwayStart && state.x <= runwayEnd && state.altitude <= 8) {
      const safeSpeed = state.speed >= 35 && state.speed <= 72;
      const gentleDescent = state.climbRate <= 0.8 && state.climbRate >= -3.2;
      if (safeSpeed && gentleDescent && state.pitch < 12 && state.passed.size === checkpoints.length) {
        finishFlight(true, `All checkpoints cleared. You landed at ${Math.round(state.speed * 1.94384)} knots and scored ${state.score} points.`);
        return;
      }
      finishFlight(false, "Keep your approach gentle, stay in the landing speed range, and fly through every checkpoint before landing.");
      return;
    }
    if (state.altitude <= 0 && state.x > 40) {
      finishFlight(false, "The aircraft came down before reaching the runway. Add a little throttle and ease the nose up.");
      return;
    }
    if (state.x > runwayEnd + 80) {
      finishFlight(false, "You flew past the runway. Lower the nose earlier and line up for a gentle approach.");
      return;
    }
    updateReadouts();
  }

  function frame(timestamp) {
    const dt = Math.min(.04, (timestamp - lastFrame) / 1000 || 0);
    lastFrame = timestamp;
    update(dt);
    draw();
    if (state.phase === "flying" || state.phase === "paused") animationId = requestAnimationFrame(frame);
  }

  function startFlight() {
    cancelAnimationFrame(animationId);
    state = makeState();
    state.phase = "flying";
    startOverlay.classList.add("hidden");
    endOverlay.classList.add("hidden");
    ui.session.textContent = "IN FLIGHT";
    lastFrame = performance.now();
    updateReadouts();
    animationId = requestAnimationFrame(frame);
  }

  startButton.addEventListener("click", startFlight);
  restartButton.addEventListener("click", startFlight);
  throttleInput.addEventListener("input", () => { state.throttle = Number(throttleInput.value); updateReadouts(); });
  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundButton.style.color = soundEnabled ? "var(--mint)" : "";
    soundButton.setAttribute("aria-label", soundEnabled ? "Mute sound" : "Enable sound");
  });

  window.addEventListener("keydown", event => {
    const key = event.code;
    if (["ArrowUp", "ArrowDown", "Space"].includes(key)) event.preventDefault();
    keys.add(key);
    if (key === "KeyP" && (state.phase === "flying" || state.phase === "paused")) {
      state.phase = state.phase === "flying" ? "paused" : "flying";
      ui.session.textContent = state.phase === "paused" ? "PAUSED" : "IN FLIGHT";
    }
  });
  window.addEventListener("keyup", event => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());

  updateReadouts();
  draw();
})();
