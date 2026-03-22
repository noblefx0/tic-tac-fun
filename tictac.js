// ── Tic-Tac-Toe multiplayer – win detection + score + chat + reactions + both-agree restart ──

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

// ── Score variables ─────────────────────────────────────────────────
let scoreX = 0;
let scoreO = 0;
const scoreDisplay = document.getElementById("score-display");

// Update score display
function updateScoreDisplay() {
  if (!scoreDisplay) return;
  scoreDisplay.textContent = `X: ${scoreX}  O: ${scoreO}`;

  if (scoreX > scoreO) scoreDisplay.className = "score x-lead";
  else if (scoreO > scoreX) scoreDisplay.className = "score o-lead";
  else scoreDisplay.className = "score";
}

// ── Chat variables ──────────────────────────────────────────────────
const chatContainer = document.getElementById("chat-container");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const chatLog = []; // last 15 messages

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || !gameId || !playerSymbol) return;

  db.ref(gameId).child("messages").push({
    text: message,
    sender: playerSymbol,
    timestamp: Date.now()
  });

  chatInput.value = "";
}

chatSend.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keypress", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendChatMessage();
  }
});

function addChatMessage(sender, text) {
  const msgEl = document.createElement("p");
  msgEl.textContent = `${sender}: ${text}`;
  msgEl.className = sender === "X" ? "x-msg" : "o-msg";

  chatLog.push(msgEl);
  if (chatLog.length > 15) chatLog.shift();

  chatMessages.innerHTML = "";
  chatLog.forEach(el => chatMessages.appendChild(el.cloneNode(true)));

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── Join / Create ───────────────────────────────────────────────────
joinBtn.addEventListener("click", () => {
  const code = roomInput.value.trim();
  if (!code) return alert("Enter a room code!");

  gameId = "games/" + code;
  const gameRef = db.ref(gameId);

  gameRef.once("value", snap => {
    const data = snap.val();

    if (!data) {
      playerSymbol = "X";
      console.log("YOU ARE X (Creator)");

      gameRef.set({
        board: Array(9).fill(null),
        currentTurn: "X",
        status: "waiting",
        winner: null,
        scores: { X: 0, O: 0 },
        messages: {},
        restartRequest: null
      }).then(() => {
        statusEl.textContent = `Game created! Share code: ${code} (You are X)`;
        startListening();
        gameActive = true;
      });
    } else if (data.status === "waiting") {
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

    // Load scores
    scoreX = data.scores?.X || 0;
    scoreO = data.scores?.O || 0;
    updateScoreDisplay();

    // Show chat UI & hide join UI when playing
    if (data.status === "playing") {
      roomInput.parentElement.style.display = "none";
      joinBtn.style.display = "none";
      if (chatContainer) chatContainer.style.display = "block";
      updateScoreDisplay();
      setupRestartConfirmation();
    }

    // Load last 15 messages
    if (data.messages) {
      const msgs = Object.values(data.messages);
      msgs.sort((a,b) => a.timestamp - b.timestamp);
      chatLog.length = 0;
      msgs.slice(-15).forEach(m => {
        addChatMessage(m.sender, m.text);
      });
    }

    // Reaction handling
    if (data.reaction && data.reaction.sentAt && data.reaction.sender) {
      const now = Date.now();
      const age = now - data.reaction.sentAt;
      if (age < 7000 && data.reaction.sender !== playerSymbol) {
        animateReceivedEmoji(data.reaction.emoji);
      }
    }

    // ── Win check ───────────────────────────────────────────────────
    const winner = getWinner(boardState);

    if (winner && !data.winner) {
      db.ref(gameId).update({ winner: winner });

      if (winner === "X") {
        scoreX++;
        db.ref(gameId).child("scores").update({ X: scoreX });
      } else if (winner === "O") {
        scoreO++;
        db.ref(gameId).child("scores").update({ O: scoreO });
      }

      updateScoreDisplay();
    }

    if (data.winner) {
      statusEl.textContent = `${data.winner} wins! Click Restart to play again.`;
      highlightWinningLine(data.winner);
      gameActive = false;
    } else {
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

    if (!gameActive || !myTurn || boardState[index] || !gameId) return;

    boardState[index] = playerSymbol;

    db.ref(gameId).update({
      board: boardState,
      currentTurn: playerSymbol === "X" ? "O" : "X"
    });
  });
});

// ── Emoji Reactions ─────────────────────────────────────────────────

const reactionButtons = document.querySelectorAll('.reaction-btn');

reactionButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (!gameId || !playerSymbol) return;

    const emoji = button.dataset.emoji;

    db.ref(gameId).child('reaction').set({
      emoji: emoji,
      sender: playerSymbol,
      sentAt: Date.now()
    }).catch(err => console.error("Reaction failed:", err));
  });
});

function animateReceivedEmoji(emoji) {
  reactionButtons.forEach(btn => btn.classList.remove('received'));

  const target = Array.from(reactionButtons).find(btn => btn.dataset.emoji === emoji);

  if (target) {
    target.classList.add('received');
    setTimeout(() => target.classList.remove('received'), 4000);
  }
}

// ── Both must agree to restart ──────────────────────────────────────
function setupRestartConfirmation() {
  // Only run if gameId exists
  if (!gameId) return;

  const restartConfirm = document.getElementById("restart-confirm");
  const restartMessage = document.getElementById("restart-message");
  const restartYes = document.getElementById("restart-yes");
  const restartNo = document.getElementById("restart-no");

  // Listen for restart request
  db.ref(gameId).child("restartRequest").on("value", snap => {
    const req = snap.val();

    if (!req || req.status !== "pending") {
      if (restartConfirm) restartConfirm.style.display = "none";
      return;
    }

    const requester = req.from === playerSymbol ? "You" : `Player ${req.from}`;
    restartMessage.textContent = `${requester} wants to restart the game. Accept?`;

    if (restartConfirm) restartConfirm.style.display = "block";
  });

  // Accept
  if (restartYes) {
    restartYes.addEventListener("click", () => {
      db.ref(gameId).child("restartRequest").update({ status: "accepted" });
      if (restartConfirm) restartConfirm.style.display = "none";
    });
  }

  // Reject
  if (restartNo) {
    restartNo.addEventListener("click", () => {
      db.ref(gameId).child("restartRequest").remove();
      if (restartConfirm) restartConfirm.style.display = "none";
    });
  }

  // When both accept → reset
  db.ref(gameId).child("restartRequest").on("value", snap => {
    const req = snap.val();

    if (req && req.status === "accepted") {
      db.ref(gameId).update({
        board: Array(9).fill(null),
        currentTurn: "X",
        winner: null
      });

      boardState = Array(9).fill(null);
      gameActive = true;
      myTurn = playerSymbol === "X";
      renderBoard();

      statusEl.textContent = "Game restarted by agreement!";

      db.ref(gameId).child("restartRequest").remove();
    }
  });
}

// Replace old restart click with request
resetBtn.addEventListener("click", () => {
  if (!gameId || !playerSymbol) {
    statusEl.textContent = "No game active";
    return;
  }

  db.ref(gameId).child("restartRequest").set({
    from: playerSymbol,
    status: "pending",
    timestamp: Date.now()
  }).then(() => {
    console.log("Restart request sent – waiting for agreement");
  }).catch(err => {
    console.error("Failed to send restart request:", err);
  });
});

// Call setup when game starts (add this inside startListening() after gameRef.on("value"))
// Inside startListening() → after if (data.status === "playing") { ... }
      
