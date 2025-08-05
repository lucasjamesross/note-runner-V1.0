// Grab the canvas and context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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
        // Note head (circle)
        ctx.beginPath();
        if (this.mouthOpen) {
          ctx.arc(this.x, this.y, this.radius, 0.2 * Math.PI, 1.8 * Math.PI);
          ctx.lineTo(this.x, this.y); // Mouth point
        } else {
          ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        }
        ctx.fillStyle = "black";
        ctx.fill();
        ctx.closePath();

        // Eye
        ctx.beginPath();
        ctx.arc(this.x + 8, this.y - 18, 4, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.closePath();

        // Tapered stem
        ctx.beginPath();
        ctx.moveTo(this.x - 32, this.y + 11);      // Bottom wide point
        ctx.lineTo(this.x - 21, this.y - 16);      // Bottom narrow point
        ctx.lineTo(this.x - 44, this.y - 100);    // Top narrow point
        ctx.lineTo(this.x - 52, this.y - 100);    // Top wide point
        ctx.closePath();
        ctx.fillStyle = "black";
        ctx.fill();

        // Curved flag at the top of the stem, curving out to the left and tapering to a point about half the stem's height
        ctx.beginPath();
        const stemTopX = this.x - 44;
        const stemTopY = this.y - 100;
        const flagTipX = this.x - 95; // Farther left
        const flagTipY = this.y - 10;  // About half the stem height down

        ctx.moveTo(stemTopX, stemTopY);
        ctx.quadraticCurveTo(
            this.x - 120, this.y - 120, // Control point, above and left of stem
            flagTipX, flagTipY          // End point (flag tip)
        );
        ctx.lineTo(flagTipX + 1, flagTipY + 8); // Tapered edge back up
        ctx.quadraticCurveTo(
            this.x - 110, this.y - 90,  // Control point, inside curve
            stemTopX - 3, stemTopY + 8 // Back to stem, slightly below top
        );
        ctx.closePath();
        ctx.fillStyle = "black";
        ctx.fill();
    }
};

// Rests collectible system
const rests = [];
let restSpawnTimer = 0;
const spawnInterval = 67; // frames

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
    lineIndex,
    width: 20,
    height: 20,
    collected: false,
    type
  });
}

function updateAndDrawRests() {
  for (let i = rests.length - 1; i >= 0; i--) {
    const rest = rests[i];
    rest.x -= 5;

    if (rest.collected) continue;

    switch (rest.type) {
      case "eighth":
        drawEighthRest(ctx, rest.x, rest.y, 1);
        break;
      case "quarter":
        drawQuarterRest(ctx, rest.x, rest.y, 1);
        break;
      case "half":
        drawHalfRest(ctx, rest.x, rest.y, 1.32);
        break;
      case "whole":
        drawWholeRest(ctx, rest.x, rest.y, 1.32);
        break;
      default:
        drawSixteenthRest(ctx, rest.x, rest.y, 1);
    }

    // Collision detection
    const dx = rest.x - note.x;
    const dy = rest.y - note.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!rest.collected && distance < note.radius) {
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
    if (rest.x + rest.width < 0) {
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
    note.targetLineIndex = note.currentLineIndex - 1;
    note.vy = game.jumpStrength;
    note.descending = false;
  } else if (e.code === "ArrowDown" && note.currentLineIndex < game.staffYPositions.length - 1) {
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
overlay.style.backgroundColor = "rgba(224, 224, 224, 0.95)";
overlay.style.fontFamily = "sans-serif";
overlay.style.textAlign = "center";
document.body.appendChild(overlay);

function showStartScreen() {
  overlay.innerHTML = `
    <h1>EAT THE RESTS TO DEFEAT THE SILENCE!</h1>
    <p>⬆️ = Jump Up &nbsp;&nbsp;&nbsp; ⬇️ = Jump Down</p>
    <button id="startButton" style="font-size: 2rem; padding: 10px 30px;">START</button>
  `;
  document.getElementById("startButton").onclick = () => {
    gameStarted = true;
    overlay.style.display = "none";
    gameLoop();
  };
}

function showGameOverScreen() {
  overlay.innerHTML = `
    <h1 style="font-size: 4rem;">THE SILENCE HAS WON</h1>
    <button id="restartButton" style="font-size: 2rem; padding: 10px 30px;">Try Again?</button>
  `;
  overlay.style.display = "flex";
  document.getElementById("restartButton").onclick = () => {
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

    // Restart game
    gameOver = false;
    overlay.style.display = "none";
    gameLoop();
  };
}

function gameLoop() {
  if (!gameStarted || gameOver) return;

  // Clear the screen
  ctx.clearRect(0, 0, game.width, game.height);

  // TEMP: background color to see it's working
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
  // drawSixteenthRest(ctx, note.x + 100, note.y, 1.2);

  // Update the score display every frame
  updateScoreDisplay();

  // Call gameLoop again on the next animation frame
  requestAnimationFrame(gameLoop);
}

function drawSixteenthRest(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "black";

  // Dots
  ctx.beginPath();
  ctx.arc(-3, -12, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-4, 0.5, 4, 0, Math.PI * 2);
  ctx.fill();

  // Diagonal slash, slanted like a forward slash (/)
  ctx.beginPath();
  ctx.moveTo(11, -16);
  ctx.lineTo(2, 22);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "black";
  ctx.stroke();

  // Curve from stem to top dot
  ctx.beginPath();
  ctx.moveTo(11, -15); // Starting point at the stem
  ctx.quadraticCurveTo(0, -9, -2, -11); // Control and end near the top dot
  ctx.lineWidth = 4;
  ctx.stroke();

  // Curve from stem to bottom dot
  ctx.beginPath();
  ctx.moveTo(7, -1); // Starting point at the stem
  ctx.quadraticCurveTo(3, 2, -5, 2.5); // Control and end near the bottom dot
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

function drawEighthRest(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "black";

  // Top dot
  ctx.beginPath();
  ctx.arc(-3, -12, 5, 0, Math.PI * 2);
  ctx.fill();

  // Diagonal slash, slanted like a forward slash (/)
  ctx.beginPath();
  ctx.moveTo(11, -16);
  ctx.lineTo(2, 22);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "black";
  ctx.stroke();

  // Curve from stem to top dot
  ctx.beginPath();
  ctx.moveTo(11, -15); // Starting point at the stem
  ctx.quadraticCurveTo(0, -9, -2, -11); // Control and end near the top dot
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.restore();
}

function drawQuarterRest(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";

  // "Z" shape 
  ctx.beginPath();
  ctx.moveTo(0, -18);       // Top-left of Z
  ctx.lineTo(15, -15);      // Top-right of Z
  ctx.lineTo(0, 1);      // Diagonal to bottom-left
  ctx.lineTo(15, 5);     // Bottom-right of Z
  ctx.stroke();

  // "c" tail with oval warp
  ctx.save();
  ctx.translate(11, 10);  // Move to arc center
  ctx.scale(1, 0.66);        // Horizontal compression
  ctx.beginPath();
  ctx.arc(0.5, 1.9, 9, Math.PI * 1.6, Math.PI * 0.45, true); // Arc centered at origin
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}
function drawHalfRest(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "black";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;

  // Draw the top hat rectangle
  ctx.beginPath();
  ctx.rect(-10, -10, 20, 10); // x, y, width, height
  ctx.fill();

  // Draw the bottom line (the hat brim)
  ctx.beginPath();
  ctx.moveTo(-17, 0);
  ctx.lineTo(17, 0);
  ctx.stroke();

  ctx.restore();
}

function drawWholeRest(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "black";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;

  // Draw the rectangle hanging below the line
  ctx.beginPath();
  ctx.rect(-10, 0, 20, 10); // x, y, width, height
  ctx.fill();

  // Draw the top line (hat brim)
  ctx.beginPath();
  ctx.moveTo(-17, 0);
  ctx.lineTo(17, 0);
  ctx.stroke();

  ctx.restore();
}
// Start the game loop
showStartScreen();