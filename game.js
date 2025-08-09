// Grab the canvas and context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- SPRITES: preload note and rest images ---
const noteImgs = { open: new Image(), closed: new Image() };
noteImgs.open.src = "images/note-open.png";
noteImgs.closed.src = "images/note-closed.png";

const restImgs = {
  sixteenth: new Image(),
  eighth: new Image(),
  quarter: new Image(),
  half: new Image(),
  whole: new Image(),
};
restImgs.sixteenth.src = "images/rest-sixteenth.png";
restImgs.eighth.src = "images/rest-eighth.png";
restImgs.quarter.src = "images/rest-quarter.png";
restImgs.half.src = "images/rest-half.png";
restImgs.whole.src = "images/rest-whole.png";

// --- SOUNDS ---
const sfx = {
  eat: new Audio("sounds/eat.wav"),
  gameOver: new Audio("sounds/gameOver.wav"),
  gameStart: new Audio("sounds/gameStart.wav"),
  jumpUp: new Audio("sounds/jumpUp.wav"),
  jumpDown: new Audio("sounds/jumpDown.wav")
};
// Preload SFX
sfx.eat.preload = "auto";
sfx.gameOver.preload = "auto";
sfx.gameStart.preload = "auto";
sfx.jumpUp.preload = "auto";
sfx.jumpDown.preload = "auto";

// --- MUSIC ---
const bgMusic = new Audio("sounds/musicLoop1.mp3");
bgMusic.loop = true;
// --- Volume controls (grouped)
let musicVolume = 0.5; // 0.0 - 1.0
let sfxVolume = 0.5;   // 0.0 - 1.0

// Apply initial volumes
bgMusic.volume = musicVolume;
Object.values(sfx).forEach(a => a.volume = sfxVolume);

function applySfxVolume(v) {
  sfxVolume = v;
  Object.values(sfx).forEach(a => a.volume = sfxVolume);
  const el = document.getElementById("sfxVolLabel");
  if (el) el.textContent = Math.round(sfxVolume * 100) + "%";
}
function applyMusicVolume(v) {
  musicVolume = v;
  bgMusic.volume = musicVolume;
  const el = document.getElementById("musicVolLabel");
  if (el) el.textContent = Math.round(musicVolume * 100) + "%";
}

let soundOn = true; // default ON

// --- Sprite sizing & alignment ---
const NOTE_SCALE = 4;           // visual size multiplier relative to radius (width = radius*2*NOTE_SCALE)
const REST_SCALE = 4;           // visual size multiplier for rests
const REST_Y_OFFSET = 0;        // tweak vertically if a rest sits too high/low
const NOTE_Y_OFFSET = 100;        // vertical nudge for note sprite (visual only)

// Game settings
const game = {
  width: canvas.width,
  height: canvas.height,
  gravity: 0.6,
  jumpStrength: -9,
  staffYPositions: (() => {
  const numLines = 5;
  const spacing = 60; // Increase or decrease spacing here as needed
  const totalHeight = (numLines - 1) * spacing;
  const top = (canvas.height - totalHeight) / 2;

  return Array.from({ length: numLines }, (_, i) => top + i * spacing);
})()
};

// Score system using fractions (e.g., 1/8 instead of 0)
let scoreNumerator = 1;
let scoreDenominator = 8; // Start as 1/8

function updateScoreDisplay() {
  const whole = Math.floor(scoreNumerator / scoreDenominator);
  const remainder = scoreNumerator % scoreDenominator;
  const fraction = remainder > 0 ? ` ${remainder}/${scoreDenominator}` : "";
  document.getElementById("score").innerText = `Score: ${whole}${fraction}`;
}

// Greatest Common Divisor to simplify fractions
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function simplifyFraction(n, d) {
  const divisor = gcd(n, d);
  return [n / divisor, d / divisor];
}

// The eighth note character
const note = {
    x: 200,
    y: 160,
    vy: 0,
    radius: 33,
    maxJumps: 3,
    jumpsRemaining: 3,
    currentLineIndex: game.staffYPositions.length - 1,
    targetLineIndex: game.staffYPositions.length - 1,
    descending: false,
    mouthOpen: true,

    jump: function () {
  if (this.jumpsRemaining > 0) {
    this.vy = game.jumpStrength;
    this.jumpsRemaining--;
  }
},
    update: function () {
  this.vy += game.gravity;
  this.y += this.vy;

  if (this.vy >= 0) {
    if (this.descending) {
      const lineY = game.staffYPositions[this.targetLineIndex];
      if (
        this.y + this.radius >= lineY - 2 &&
        this.y + this.radius <= lineY + 10
      ) {
        this.y = lineY - this.radius;
        this.vy = 0;
        this.currentLineIndex = this.targetLineIndex;
        this.descending = false;
        this.jumpsRemaining = this.maxJumps;
      }
    } else {
      for (let i = game.staffYPositions.length - 1; i >= 0; i--) {
        const lineY = game.staffYPositions[i];
        if (
          this.y + this.radius >= lineY - 2 &&
          this.y + this.radius <= lineY + 10
        ) {
          this.y = lineY - this.radius;
          this.vy = 0;
          this.currentLineIndex = i;
          this.targetLineIndex = i;
          this.jumpsRemaining = this.maxJumps;
          break;
        }
      }
    }
  }

  // Prevent falling below bottom of canvas
  if (this.y > game.height - this.radius) {
    this.y = game.height - this.radius;
    this.vy = 0;
    this.jumpsRemaining = this.maxJumps;
  }
},
    draw: function () {
      const img = this.mouthOpen ? noteImgs.open : noteImgs.closed;
      const w = this.radius * 2 * NOTE_SCALE;
      const h = w; // square sprite assumed
      const left = this.x - w / 2;            // center horizontally on note.x
      const top  = (this.y + this.radius) - h + NOTE_Y_OFFSET; // add visual nudge
      ctx.drawImage(img, left, top, w, h);
    }
};

// Rests collectible system
const rests = [];
let restSpawnTimer = 0;
const baseSpawnInterval = 111; // frames between spawns at start
const minSpawnInterval = 20;   // hardest setting (lower = more frequent)
let spawnInterval = baseSpawnInterval;

// Cap difficulty adjustments after this many seconds
const DIFFICULTY_LOCK_SECONDS = 60;
let runStartTime = performance.now();

// Score-based difficulty ramp (higher score => faster spawns)
const difficultyPerPoint = 6; // frames reduced per 1.0 score

const restValues = {
  sixteenth: [1, 16],
  eighth: [1, 8],
  quarter: [1, 4],
  half: [1, 2],
  whole: [1, 1],
};

function spawnRest() {
  const lineIndex = Math.floor(Math.random() * game.staffYPositions.length);
  const y = game.staffYPositions[lineIndex];

  const restTypes = ["sixteenth", "eighth", "quarter", "half", "whole"];
  const type = restTypes[Math.floor(Math.random() * restTypes.length)];

  rests.push({
    x: game.width + 20,
    y: y - note.radius + 5,
    collected: false,
    type
  });
}

function updateAndDrawRests() {
  for (let i = rests.length - 1; i >= 0; i--) {
    const rest = rests[i];
    rest.x -= 5;

    if (rest.collected) continue;

    // Draw rest sprite (center anchor)
    const rw = note.radius * 2 * REST_SCALE;
    const rh = rw; // square sprite assumed
    const rleft = rest.x - rw / 2;
    const rtop  = rest.y - rh / 2 + REST_Y_OFFSET;
    ctx.drawImage(restImgs[rest.type], rleft, rtop, rw, rh);

    // Collision detection
    const dx = rest.x - note.x;
    const dy = rest.y - note.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Collision hotspot for the mouth
    // const mouthY = note.y - note.radius * 0.1;   // slight upward bias
    const mouthY = note.y - note.radius * 0.1 + NOTE_Y_OFFSET;   // match note draw offset

    if (!rest.collected && distance < note.radius) {
      if (soundOn) {
        sfx.eat.currentTime = 0;
        sfx.eat.play();
      }
      // Eaten
      rest.collected = true;
      const [addN, addD] = restValues[rest.type];
      scoreNumerator = scoreNumerator * addD + addN * scoreDenominator;
      scoreDenominator = scoreDenominator * addD;
      [scoreNumerator, scoreDenominator] = simplifyFraction(scoreNumerator, scoreDenominator);
      note.mouthOpen = false;
      setTimeout(() => {
        note.mouthOpen = true;
      }, 222);
    }

    // Remove offscreen or missed rests
    if (rest.x + (note.radius * 2 * REST_SCALE) < 0) {
      if (!rest.collected) {
        // Missed
        const [subN, subD] = restValues[rest.type];
        scoreNumerator = scoreNumerator * subD - subN * scoreDenominator;
        scoreDenominator = scoreDenominator * subD;
        [scoreNumerator, scoreDenominator] = simplifyFraction(scoreNumerator, scoreDenominator);

        if (scoreNumerator <= 0) {
          gameOver = true;
          showGameOverScreen();
        }
      }
      rests.splice(i, 1);
    }
  }
}

document.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" && note.currentLineIndex > 0) {
    if (soundOn) {
      sfx.jumpUp.currentTime = 0;
      sfx.jumpUp.play();
    }
    note.targetLineIndex = note.currentLineIndex - 1;
    note.vy = game.jumpStrength;
    note.descending = false;
  } else if (e.code === "ArrowDown" && note.currentLineIndex < game.staffYPositions.length - 1) {
    if (soundOn) {
      sfx.jumpDown.currentTime = 0;
      sfx.jumpDown.play();
    }
    note.targetLineIndex = note.currentLineIndex + 1;
    note.vy = -game.jumpStrength * 0.8; // softer downward motion
    note.descending = true;
  }
});

function drawStaffLines() {
  ctx.strokeStyle = "#444"; // Dark grey, not pure black
  ctx.lineWidth = 2;

  for (let i = 0; i < game.staffYPositions.length; i++) {
    const y = game.staffYPositions[i];
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(game.width, y);
    ctx.stroke();
  }
}

let gameStarted = false;
let gameOver = false;

const overlay = document.createElement("div");
overlay.style.position = "absolute";
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.display = "flex";
overlay.style.flexDirection = "column";
overlay.style.alignItems = "center";
overlay.style.justifyContent = "center";
overlay.style.backgroundColor = "rgba(255, 255, 255, 1)";
overlay.style.fontFamily = "sans-serif";
overlay.style.textAlign = "center";
document.body.appendChild(overlay);

function showStartScreen() {
  overlay.innerHTML = `
    <h1>EAT THE RESTS TO DEFEAT THE SILENCE!</h1>
    <p>⬆️ = Jump Up &nbsp;&nbsp;&nbsp; ⬇️ = Jump Down</p>
    <button id="soundToggle" style="font-size: 1.2rem; padding: 5px 15px; margin-bottom: 12px;">Sound: OFF</button>
    <div style="display:flex; gap:24px; align-items:center; margin-bottom: 12px; flex-wrap:wrap; justify-content:center;">
      <label style="font-size:0.95rem;">Music Volume: <span id="musicVolLabel">${Math.round(musicVolume*100)}%</span></label>
      <input id="musicVol" type="range" min="0" max="1" step="0.05" value="${musicVolume}" style="width:220px;" />
    </div>
    <div style="display:flex; gap:24px; align-items:center; margin-bottom: 20px; flex-wrap:wrap; justify-content:center;">
      <label style="font-size:0.95rem;">SFX Volume: <span id="sfxVolLabel">${Math.round(sfxVolume*100)}%</span></label>
      <input id="sfxVol" type="range" min="0" max="1" step="0.05" value="${sfxVolume}" style="width:220px;" />
    </div>
    <button id="startButton" style="font-size: 2rem; padding: 10px 30px;">START</button>
  `;
  document.getElementById("startButton").onclick = () => {
    gameStarted = true;
    overlay.style.display = "none";

    if (soundOn) {
      sfx.gameStart.currentTime = 0;
      sfx.gameStart.play();
    }
    if (soundOn) {
      bgMusic.currentTime = 0;
      bgMusic.play();
    }

    // Reset spawn timer & interval to base, and restart difficulty timer
    restSpawnTimer = 0;
    spawnInterval = baseSpawnInterval;
    runStartTime = performance.now();

    gameLoop();
  };
  document.getElementById("soundToggle").onclick = () => {
    soundOn = !soundOn;
    document.getElementById("soundToggle").innerText = soundOn ? "Sound: ON" : "Sound: OFF";
    if (soundOn) {
      if (gameStarted && !gameOver) {
        bgMusic.currentTime = 0;
        bgMusic.play();
      }
    } else {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }
  };
  // Add volume slider event listeners
  const musicSlider = document.getElementById("musicVol");
  musicSlider.addEventListener("input", (e) => {
    applyMusicVolume(parseFloat(e.target.value));
    // If music is currently on and game running, reflect new volume immediately
    if (soundOn && gameStarted && !gameOver) {
      bgMusic.volume = musicVolume;
    }
  });

  const sfxSlider = document.getElementById("sfxVol");
  sfxSlider.addEventListener("input", (e) => {
    applySfxVolume(parseFloat(e.target.value));
  });
}

function showGameOverScreen() {
  // Stop background music on game over
  bgMusic.pause();
  bgMusic.currentTime = 0;
  if (soundOn) {
    sfx.gameOver.currentTime = 0;
    sfx.gameOver.play();
  }
  overlay.innerHTML = `
    <h1 style="font-size: 4rem;">THE SILENCE HAS WON</h1>
    <button id="restartButton" style="font-size: 2rem; padding: 10px 30px;">Try Again?</button>
  `;
  overlay.style.display = "flex";
  document.getElementById("restartButton").onclick = () => {
    if (soundOn) {
      sfx.gameStart.currentTime = 0;
      sfx.gameStart.play();
    }
    if (soundOn) {
      bgMusic.currentTime = 0;
      bgMusic.play();
    }
    // Reset score
    scoreNumerator = 1;
    scoreDenominator = 8;
    updateScoreDisplay();

    // Reset note properties
    note.y = game.staffYPositions[game.staffYPositions.length - 1] - note.radius;
    note.vy = 0;
    note.jumpsRemaining = note.maxJumps;
    note.currentLineIndex = game.staffYPositions.length - 1;
    note.targetLineIndex = game.staffYPositions.length - 1;
    note.descending = false;
    note.mouthOpen = true;

    // Clear rests
    rests.length = 0;
    restSpawnTimer = 0;

    // Reset spawn interval to base
    spawnInterval = baseSpawnInterval;
    runStartTime = performance.now();

    // Restart game
    gameOver = false;
    overlay.style.display = "none";
    gameLoop();
  };
}

function gameLoop() {
  if (!gameStarted || gameOver) return;

  // --- Difficulty ramp: score-based until time cap, then freeze
  const elapsed = (performance.now() - runStartTime) / 1000;
  if (elapsed <= DIFFICULTY_LOCK_SECONDS) {
    const scoreValue = scoreNumerator / scoreDenominator; // e.g., 1/8 => 0.125
    const maxReduction = baseSpawnInterval - minSpawnInterval;
    const reduction = Math.min(maxReduction, difficultyPerPoint * scoreValue);
    spawnInterval = Math.max(minSpawnInterval, Math.round(baseSpawnInterval - reduction));
  } else {
    // After the cap, keep current spawnInterval but never go below the floor
    spawnInterval = Math.max(minSpawnInterval, spawnInterval);
  }

  // Clear the screen
  ctx.clearRect(0, 0, game.width, game.height);

  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, 0, game.width, game.height);

  drawStaffLines();

  note.update();
  note.draw();


  // Spawn and update rests
  restSpawnTimer++;
  if (restSpawnTimer >= spawnInterval) {
    spawnRest();
    restSpawnTimer = 0;
  }

  updateAndDrawRests();

  // Optionally, draw a demo rest ahead of the note

  // Update the score display every frame
  updateScoreDisplay();

  // Call gameLoop again on the next animation frame
  requestAnimationFrame(gameLoop);
}

// Start the game loop
showStartScreen();
// Initialize volume labels on first render (if elements exist)
applyMusicVolume(musicVolume); applySfxVolume(sfxVolume);