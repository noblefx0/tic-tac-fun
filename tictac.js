// ── Variables ───────────────────────────────────────────────────────
const cells = document.querySelectorAll('.cell');
const statusEl = document.getElementById('status');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomCode');
const resetBtn = document.getElementById('reset');

let gameId = null;           // e.g. "games/room-xyz123"
let playerSymbol = null;     // "X" or "O"
let myTurn = false;
let gameActive = false;
let boardState = Array(9).fill(null);

// ── Join / Create room ──────────────────────────────────────────────
joinBtn.addEventListener('click', () => {
  const code = roomInput.value.trim();
  if (!code) {
    alert("Please enter a room code");
    return;
  }

  gameId = "games/" + code;
  const gameRef = db.ref(gameId);

  gameRef.once("value", (snap) => {
    const data = snap.val();

    if (!data) {
      // Create new game as X
      playerSymbol = "X";
      gameRef.set({
        board: Array(9).fill(null),
        currentTurn: "X",
        status: "waiting",
        winner: null
      }).then(() => {
        statusEl.textContent = `Game created! Share code: ${code} (You are X)`;
      });
    } 
    else if (data.status === "waiting" && !data.players?.O) {
      // Join as O
      playerSymbol = "O";
      gameRef.update({
        status: "playing",
        players: { ...(data.players || {}), O: "Player 2" }
      }).then(() => {
        statusEl.textContent = "Joined! You are O — waiting for X to move";
      });
    } 
    else {
      alert("Game is full, in progress, or finished. Try another code.");
      return;
    }

    // Start listening once we're in
    listenToGame();
  }).catch(err => {
    console.error("Firebase error:", err);
    alert("Something went wrong — check console");
  });
});

// ── Listen for realtime updates ─────────────────────────────────────
function listenToGame() {
  const gameRef = db.ref(gameId);

  gameRef.on("value", (snap) => {
    const data = snap.val();
    if (!data) return;

    boardState = data.board || Array(9).fill(null);
    renderBoard();

    const isPlaying = data.status === "playing" || data.status === "waiting";

    if (data.winner) {
      gameActive = false;
      statusEl.textContent = `${data.winner} wins!`;
      highlightWinningLine(data.board, data.winner);
      return;
    }

    if (boardState.every(cell => cell !== null)) {
      gameActive = false;
      statusEl.textContent = "It's a draw!";
      return;
    }

    if (isPlaying) {
      gameActive = true;
      myTurn = (data.currentTurn === playerSymbol);
      statusEl.textContent = myTurn 
        ? "Your turn!" 
        : `Waiting for ${data.currentTurn}...`;
    }
  });
}

// ── Render board ────────────────────────────────────────────────────
function renderBoard() {
  cells.forEach((cell, i) => {
    cell.textContent = boardState[i] || '';
    cell.classList.remove('winner');
  });
}

// ── Player makes a move ─────────────────────────────────────────────
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = parseInt(cell.dataset.index);

    if (!gameActive || !myTurn || boardState[index] || !gameId) {
      return;
    }

    boardState[index] = playerSymbol;

    db.ref(gameId).update({
      board: boardState,
      currentTurn: playerSymbol === "X" ? "O" : "X"
    }).then(() => {
      // The .on("value") listener will catch the update and check win/draw
    });
  });
});

// ── Check win & highlight (called indirectly via listener) ───────────
function highlightWinningLine(board, winner) {
  const winPatterns = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];

  for (let pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] === winner && board[b] === winner && board[c] === winner) {
      [a,b,c].forEach(idx => cells[idx].classList.add('winner'));
      break;
    }
  }
}

// ── Reset ───────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  if (!gameId) return;

  db.ref(gameId).update({
    board: Array(9).fill(null),
    currentTurn: "X",
    status: "playing",
    winner: null
  });
});