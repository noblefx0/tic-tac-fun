// ── Tic-Tac-Toe multiplayer – win detection only ────────────────────

const cells = document.querySelectorAll(".cell");
const statusEl = document.getElementById("status");
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomCode");
const resetBtn = document.getElementById("reset");

let gameId = null;
let playerSymbol = null; // "X" or "O"
let myTurn = false;
let gameActive = true; // stays true even on full board
let boardState = Array(9).fill(null);

// ── Join / Create ───────────────────────────────────────────────────
joinBtn.addEventListener("click", () => {
    const code = roomInput.value.trim();
    if (!code) return alert("Enter a room code!");

    gameId = "games/" + code;
    const gameRef = db.ref(gameId);

    gameRef.once("value", snap => {
        const data = snap.val();

        if (!data) {
            // Create new game as X
            playerSymbol = "X";
            console.log("YOU ARE X (Creator)");

            gameRef
                .set({
                    board: Array(9).fill(null),
                    currentTurn: "X",
                    status: "waiting",
                    winner: null
                })
                .then(() => {
                    statusEl.textContent = `Game created! Share code: ${code} (You are X)`;
                    startListening();
                    gameActive = true;
                });
        } else if (data.status === "waiting") {
            // Join as O
            playerSymbol = "O";
            console.log("YOU ARE O (Joiner)");

            gameRef.update({ status: "playing" }).then(() => {
                statusEl.textContent = "Joined! You are O – game starting…";
                startListening();
                gameActive = true;
            });
        } else {
            alert("Game already full or finished. Use a new code.");
        }
    });
});

// ── Listen for changes ──────────────────────────────────────────────
function startListening() {
    db.ref(gameId).on("value", snap => {
        const data = snap.val();
        if (!data) return;

        boardState = data.board || Array(9).fill(null);
        renderBoard();

        // ── ONLY check for winner ───────────────────────────────────────
        const winner = getWinner(boardState);

        if (winner && !data.winner) {
            // only announce first time
            db.ref(gameId).update({ winner: winner }); // save it
        }

        if (data.winner) {
            statusEl.textContent = `${data.winner} wins! Click Restart to play again.`;
            highlightWinningLine(data.winner);
            gameActive = false; // block moves until restart
        } else {
            // normal turn logic only when no winner yet
            if (data.status === "playing") {
                gameActive = true;
                myTurn = data.currentTurn === playerSymbol;

                statusEl.textContent = myTurn
                    ? `YOUR TURN (${playerSymbol})`
                    : `Waiting for ${data.currentTurn}…`;
            } else if (data.status === "waiting") {
                statusEl.textContent = "Waiting for second player…";
            }
        }

        // No draw check → game continues even if board is full

        // ── Normal gameplay state ───────────────────────────────────────
        if (data.status === "playing") {
            myTurn = data.currentTurn === playerSymbol;

            statusEl.textContent = myTurn
                ? `YOUR TURN (${playerSymbol})`
                : `Waiting for ${data.currentTurn}…`;

            console.log(
                `I am ${playerSymbol} | turn: ${data.currentTurn} | myTurn: ${myTurn}`
            );
        } else if (data.status === "waiting") {
            statusEl.textContent = "Waiting for second player…";
        }
    });
}

// ── Win checking ────────────────────────────────────────────────────
function getWinner(board) {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8], // rows
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8], // columns
        [0, 4, 8],
        [2, 4, 6] // diagonals
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
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (let [a, b, c] of lines) {
        if (
            boardState[a] === winner &&
            boardState[b] === winner &&
            boardState[c] === winner
        ) {
            cells[a].classList.add("winner");
            cells[b].classList.add("winner");
            cells[c].classList.add("winner");
            return; // only one winning line highlighted
        }
    }
}

// ── Render the board ────────────────────────────────────────────────
function renderBoard() {
    cells.forEach((cell, i) => {
        cell.textContent = boardState[i] || "";
        cell.classList.remove("winner"); // clear old highlight
    });
}

// ── Make a move ─────────────────────────────────────────────────────
cells.forEach(cell => {
    cell.addEventListener("click", () => {
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

  if (!confirm("Restart game? Board clears – starter switches.")) {
    return;
  }

  const gameRef = db.ref(gameId);

  // 1. Get current state first (to know who should start next)
  gameRef.once("value", (snap) => {
    const data = snap.val() || {};
    const nextTurnBeforeReset = data.currentTurn || "X";  // fallback to X

    // 2. The player who would play NEXT becomes the one who starts after restart
    //    (because currentTurn = the one who did NOT play last)
    const newStartingPlayer = nextTurnBeforeReset;

    // 3. Perform the reset
    gameRef.update({
      board: Array(9).fill(null),
      currentTurn: newStartingPlayer,
      winner: null
      // status stays "playing"
    })
    .then(() => {
      // Local UI feedback
      gameActive = true;
      myTurn = (playerSymbol === newStartingPlayer);

      cells.forEach(cell => cell.classList.remove('winner'));

      statusEl.textContent = myTurn
        ? `YOUR TURN (${playerSymbol}) – new game!`
        : `Waiting for ${newStartingPlayer} – new game started`;

      console.log(`Restarted → ${newStartingPlayer} starts (because they didn't play last)`);
    })
    .catch(err => {
      console.error("Restart failed:", err);
      statusEl.textContent = "Restart failed – try again";
    });
  });
});

// ── Emoji Reactions ─────────────────────────────────────────────────

const reactionButtons = document.querySelectorAll('.reaction-btn');
const floatingReaction = document.getElementById('floating-reaction');

// Listen for clicks on reaction buttons
reactionButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!gameId) return; // no game → ignore

    const emoji = btn.dataset.emoji;

    // Send to Firebase
    db.ref(gameId).child('reaction').set({
      emoji: emoji,
      timestamp: Date.now()  // to detect new ones
    })
    .catch(err => console.error("Reaction send failed:", err));
  });
});

// Watch for reactions in the game listener
// → Add this INSIDE your existing gameRef.on("value", (snap) => { ... }) block
// Best place: right after boardState = data.board ... and renderBoard();

if (data.reaction && data.reaction.timestamp) {
  const now = Date.now();
  const age = now - data.reaction.timestamp;

  // Only show if reaction is recent (prevents showing old ones on join)
  if (age < 6000) {  // less than 6 seconds old
    showFloatingEmoji(data.reaction.emoji);
  }
}

// Function to show the big floating emoji
function showFloatingEmoji(emoji) {
  floatingReaction.textContent = emoji;
  floatingReaction.classList.remove('fade-out');
  floatingReaction.classList.add('show');

  // Auto fade out after 5 seconds
  setTimeout(() => {
    floatingReaction.classList.add('fade-out');
    setTimeout(() => {
      floatingReaction.classList.remove('show', 'fade-out');
      floatingReaction.textContent = '';
    }, 800); // match fade-out transition time
  }, 4200); // visible for \~4.2s + animation buffer = \~5s total
}
