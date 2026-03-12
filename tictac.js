// ── FRESH REBUILD - ONLY TURN SWITCHING ─────────────────────────────

const cells = document.querySelectorAll('.cell');
const statusEl = document.getElementById('status');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomCode');

let gameId = null;
let playerSymbol = null;   // "X" or "O"
let myTurn = false;
let gameActive = false;
let boardState = Array(9).fill(null);

// Join / Create
joinBtn.addEventListener('click', () => {
  const code = roomInput.value.trim();
  if (!code) return alert("Enter a room code!");

  gameId = "games/" + code;
  const gameRef = db.ref(gameId);

  gameRef.once("value", (snap) => {
    const data = snap.val();

    if (!data) {
      // === CREATE GAME ===
      playerSymbol = "X";
      console.log("YOU ARE X (Creator)");

      gameRef.set({
        board: Array(9).fill(null),
        currentTurn: "X",
        status: "waiting"
      }).then(() => {
        statusEl.textContent = `Game created! Share code: ${code} (You are X)`;
        startListening();
      });
    } 
    else if (data.status === "waiting") {
      // === JOIN GAME ===
      playerSymbol = "O";
      console.log("YOU ARE O (Joiner)");

      gameRef.update({ status: "playing" }).then(() => {
        statusEl.textContent = "Joined! You are O";
        startListening();
      });
    } else {
      alert("Game already full or finished. Use a new code.");
    }
  });
});

// Start listening to Firebase
function startListening() {
  db.ref(gameId).on("value", (snap) => {
    const data = snap.val();
    if (!data) return;

    boardState = data.board || Array(9).fill(null);
    renderBoard();

    // Only show turns when game is actually playing
    if (data.status === "playing") {
      gameActive = true;
      myTurn = (data.currentTurn === playerSymbol);

      statusEl.textContent = myTurn 
        ? `YOUR TURN (${playerSymbol})` 
        : `Waiting for ${data.currentTurn}...`;

      console.log(`DEBUG → I am ${playerSymbol} | Turn: ${data.currentTurn} | My turn: ${myTurn}`);
    } else {
      statusEl.textContent = "Waiting for second player...";
    }
  });
}

// Render board
function renderBoard() {
  cells.forEach((cell, i) => {
    cell.textContent = boardState[i] || "";
  });
}

// Click to play
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = parseInt(cell.dataset.index);

    if (!gameActive || !myTurn || boardState[index] || !gameId) return;

    boardState[index] = playerSymbol;

    db.ref(gameId).update({
      board: boardState,
      currentTurn: playerSymbol === "X" ? "O" : "X"
    });
  });
});