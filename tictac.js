// ── Tic-Tac-Toe multiplayer – win detection only + fixed reactions ──

const cells = document.querySelectorAll(".cell");
const statusEl = document.getElementById("status");
const joinBtn = document.getElementById("joinBtn");
const roomInput = document.getElementById("roomCode");
const resetBtn = document.getElementById("reset");

let gameId = null;
let playerSymbol = null; // "X" or "O"
let myTurn = false;
let gameActive = true;
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
            // Create as X
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

        // ── Reaction handling ───────────────────────────────────────
        if (data.reaction && data.reaction.sentAt) {
            const now = Date.now();
            const age = now - data.reaction.sentAt;
            if (age < 7000) {
                animateReceivedEmoji(data.reaction.emoji);
                console.log("Reaction received & animated:", data.reaction.emoji);
            }
        }

        // ── Win check ───────────────────────────────────────────────
        const winner = getWinner(boardState);

        if (winner && !data.winner) {
            db.ref(gameId).update({ winner: winner });
        }

        if (data.winner) {
            statusEl.textContent = `${data.winner} wins! Click Restart to play again.`;
            highlightWinningLine(data.winner);
            gameActive = false;
        } else {
            // Normal turn logic
            if (data.status === "playing") {
                gameActive = true;
                myTurn = data.currentTurn === playerSymbol;

                statusEl.textContent = myTurn
                    ? `YOUR TURN (${playerSymbol})`
                    : `Waiting for ${data.currentTurn}…`;

                console.log(`I am ${playerSymbol} | turn: ${data.currentTurn} | myTurn: ${myTurn}`);
            } else if (data.status === "waiting") {
                statusEl.textContent = "Waiting for second player…";
            }
        }
    });
}

// ── Win checking ────────────────────────────────────────────────────
function getWinner(board) {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];

    for (let [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

// ── Highlight winning line ──────────────────────────────────────────
function highlightWinningLine(winner) {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];

    for (let [a,b,c] of lines) {
        if (boardState[a] === winner && boardState[b] === winner && boardState[c] === winner) {
            cells[a].classList.add("winner");
            cells[b].classList.add("winner");
            cells[c].classList.add("winner");
            return;
        }
    }
}

// ── Render board ────────────────────────────────────────────────────
function renderBoard() {
    cells.forEach((cell, i) => {
        cell.textContent = boardState[i] || "";
        cell.classList.remove("winner");
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

    gameRef.once("value", (snap) => {
        const data = snap.val() || {};
        const nextTurnBeforeReset = data.currentTurn || "X";
        const newStartingPlayer = nextTurnBeforeReset;

        gameRef.update({
            board: Array(9).fill(null),
            currentTurn: newStartingPlayer,
            winner: null
        })
        .then(() => {
            gameActive = true;
            myTurn = (playerSymbol === newStartingPlayer);

            cells.forEach(cell => cell.classList.remove('winner'));

            statusEl.textContent = myTurn
                ? `YOUR TURN (${playerSymbol}) – new game!`
                : `Waiting for ${newStartingPlayer} – new game started`;

            console.log(`Restarted → ${newStartingPlayer} starts`);
        })
        .catch(err => {
            console.error("Restart failed:", err);
            statusEl.textContent = "Restart failed – try again";
        });
    });
});

// ── Emoji Reactions – enlarge received emoji on opponent's screen ──

const reactionButtons = document.querySelectorAll('.reaction-btn');

// Send reaction
reactionButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (!gameId) {
            statusEl.textContent = "No game active – can't react";
            return;
        }

        const emoji = button.dataset.emoji;

        db.ref(gameId).child('reaction').set({
            emoji: emoji,
            sentAt: Date.now()
        }).then(() => {
            console.log("Reaction sent:", emoji);
        }).catch(err => {
            console.error("Failed to send reaction:", err);
        });
    });
});

// Animate received emoji
function animateReceivedEmoji(emoji) {
    reactionButtons.forEach(btn => btn.classList.remove('received'));

    const target = Array.from(reactionButtons).find(btn => btn.dataset.emoji === emoji);

    if (target) {
        target.classList.add('received');
        console.log("Animating emoji on this screen:", emoji);

        setTimeout(() => {
            target.classList.remove('received');
        }, 4000);
    } else {
        console.warn("No reaction button found for:", emoji);
    }
                 }
