// ── Tic-Tac-Toe multiplayer – win detection only ────────────────────

const cells = document.querySelectorAll('.cell');
const statusEl = document.getElementById('status');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomCode');
const resetBtn = document.getElementById('reset');

let gameId = null;
let playerSymbol = null;   // "X" or "O"
let myTurn = false;
let gameActive = true;     // stays true even on full board
let boardState = Array(9).fill(null);

// ── Join / Create ───────────────────────────────────────────────────
joinBtn.addEventListener('click', () => {
  const code = roomInput.value.trim();
  if (!code) return alert("Enter a room code!");

  gameId = "games/" + code;
  const gameRef = db.ref(gameId);

  gameRef.once("value", (snap) => {
    const data = snap.val();

    if (!data) {
      // Create new game as X
      playerSymbol = "X";
      console.log("YOU ARE X (Creator)");

      gameRef.set({
        board: Array(9).fill(null),
        currentTurn: "X",
        status: "waiting",
        winner: null
      }).then(() => {
        statusEl.textContent = `Game created! Share code: ${code} (You are X)`;
        startListening();
      });
    }
    else if (data.status === "waiting") {
      // Join as O
      playerSymbol = "O";
      console.log("YOU ARE O (Joiner)");

      gameRef.update({ status: "playing" }).then(() => {
        statusEl.textContent = "Joined! You are O – game starting…";
        startListening();
      });
    } else {
      alert("Game already full or finished. Use a new code.");
    }
  });
});

// ── Listen for changes ──────────────────────────────────────────────
function startListening() {
  db.ref(gameId).on("value", (snap) => {
    const data = snap.val();
    if (!data) return;

    boardState = data.board || Array(9).fill(null);
    renderBoard();

    // ── ONLY check for winner ───────────────────────────────────────
    const winner = getWinner(boardState);

    if (winner) {
      gameActive = false;
      statusEl.textContent = `${winner} wins!`;
      highlightWinningLine(winner);
      return;
    }

    // No draw check → game continues even if board is full

    // ── Normal gameplay state ───────────────────────────────────────
    if (data.status === "playing") {
      myTurn = (data.currentTurn === playerSymbol);

      statusEl.textContent = myTurn
        ? `YOUR TURN (${playerSymbol})`
        : `Waiting for ${data.currentTurn}…`;

      console.log(`I am ${playerSymbol} | turn: ${data.currentTurn} | myTurn: ${myTurn}`);
    }
    else if (data.status === "waiting") {
      statusEl.textContent = "Waiting for second player…";
    }
  });
}

// ── Win checking ────────────────────────────────────────────────────
function getWinner(board) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],    // rows
    [0,3,6], [1,4,7], [2,5,8],    // columns
    [0,4,8], [2,4,6]              // diagonals
  ];

  for (let [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

// ── Highlight winning cells ─────────────────────────────────────────
function highlightWinningLine(winner) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];

  for (let [a, b, c] of lines) {
    if (
      boardState[a] === winner &&
      boardState[b] === winner &&
      boardState[c] === winner
    ) {
      cells[a].classList.add('winner');
      cells[b].classList.add('winner');
      cells[c].classList.add('winner');
      return; // only one winning line highlighted
    }
  }
}

// ── Render the board ────────────────────────────────────────────────
function renderBoard() {
  cells.forEach((cell, i) => {
    cell.textContent = boardState[i] || '';
    cell.classList.remove('winner');   // clear old highlight
  });
}

// ── Make a move ─────────────────────────────────────────────────────
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = Number(cell.dataset.index);

    if (!gameActive || !myTurn || boardState[index] || !gameId) {
      return;
    }

    boardState[index] = playerSymbol;

    db.ref(gameId).update({
      board: boardState,
      currentTurn: playerSymbol === "X" ? "O" : "X"
    });
  });
});

// ── Restart game ────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  if (!gameId) {
    statusEl.textContent = "No active game";
    return;
  }

  if (!confirm("Restart the game? Board will be cleared.")) {
    return;
  }

  db.ref(gameId).update({
    board: Array(9).fill(null),
    currentTurn: "X",
    status: "waiting",
    winner: null
  })
  .then(() => {
    console.log("Game restarted");
  })
  .catch(err => {
    console.error("Reset failed:", err);
  });
});