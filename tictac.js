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
    const data = snap.val() || {};

    if (!data.board) {  // game doesn't exist yet
      // Create as X
      playerSymbol = "X";
      console.log("[CREATE] I am", playerSymbol);

      gameRef.set({
        board: Array(9).fill(null),
        currentTurn: "X",
        status: "waiting",
        players: { X: "Player 1" }  // Add this
      }).then(() => {
        statusEl.textContent = `Game created! Share this code: ${code} (You are X)`;
        listenToGame();
      });
    } 
    else if (data.status === "waiting" && !data.players.O) {
      // Join as O
      playerSymbol = "O";
      console.log("[JOIN] I am", playerSymbol);

      gameRef.update({
        status: "playing",
        players: { ...data.players, O: "Player 2" }
      }).then(() => {
        statusEl.textContent = `Joined game! You are O — waiting for X...`;
        listenToGame();
      });
    } 
    else {
      alert("Game is full, already started, or finished. Choose another code.");
      return;
    }
  }).catch(err => {
    console.error("Firebase error:", err);
    alert("Error connecting — check console");
  });
});

// ── Listen for realtime updates ─────────────────────────────────────
function listenToGame() {
  if (!gameId) return;

  const gameRef = db.ref(gameId);

  gameRef.on("value", (snap) => {
    const data = snap.val();
    if (!data) {
      statusEl.textContent = "Game no longer exists";
      return;
    }

    boardState = data.board || Array(9).fill(null);
    renderBoard();

    // ── Check for win or draw on the current board ─────────────────
    const winner = getWinner(boardState);
    if (winner) {
      gameActive = false;
      statusEl.textContent = `${winner} wins! (You are ${playerSymbol})`;
      highlightWinningLine(boardState, winner);
      return;
    }

    if (boardState.every(v => v !== null)) {
      gameActive = false;
      statusEl.textContent = `It's a draw! (You are ${playerSymbol})`;
      return;
    }

    // ── Handle status ──────────────────────────────────────────────
    if (data.status === "waiting") {
      gameActive = false;
      statusEl.textContent = `Waiting for opponent... (You are ${playerSymbol})`;
      return;
    }

    if (data.status === "playing") {
      gameActive = true;
      myTurn = (data.currentTurn === playerSymbol);
      statusEl.textContent = myTurn 
        ? `Your turn (${playerSymbol})` 
        : `Waiting for ${data.currentTurn}... (You are ${playerSymbol})`;

      // Debug print — open console in BOTH tabs!
      console.log("Game state:", {
        mySymbol: playerSymbol,
        currentTurn: data.currentTurn,
        myTurn: myTurn,
        board: boardState,
        status: data.status
      });
    }
  });
}

// ── Get winner from board ───────────────────────────────────────────
function getWinner(board) {
  const winPatterns = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];

  for (let pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
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
      console.log("Move made by", playerSymbol);
    }).catch(err => {
      console.error("Move error:", err);
    });
  });
});

// ── Highlight winning line ──────────────────────────────────────────
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
    status: "playing"  // Assumes both players are still in; otherwise reset to waiting if needed
  });
});