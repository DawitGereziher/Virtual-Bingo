// game/bingoSocket.js
const { Server } = require('socket.io');
const { format } = require('date-fns');

const MAX_NUMBER = 75;
const DRAW_INTERVAL = 7000; // 7 seconds
const WAIT_AFTER_GAME_MS = 5 * 60 * 1000; // 5 minutes

const PATTERNS = ['star', 'cross', 'diagonal', 'corners'];
const FULL_HOUSE = 'full_house';

let io;
let remainingNumbers = [];
let drawnNumbers = [];
let currentNumber = null;
let drawTimer = null;

let selectedPatterns = [];
let currentPatternIndex = 0;

let currentRoundInfo = null;
let nextRoundInfo = null;

let gameCounter = 1; // Increases each game of the day
let lastRoundDate = format(new Date(), 'yyyyMMdd'); // Track last date to reset daily
//--------------------------------------------------

function setupBingoSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on('connection', (socket) => {
    console.log('📡 Agent connected:', socket.id);

    socket.emit('bingo-state', {
      currentNumber,
      drawnNumbers,
      remainingCount: remainingNumbers.length,
      currentPattern: currentRoundInfo?.pattern || null,
      currentRoundInfo,
      nextRoundInfo,
    });

    socket.on('disconnect', () => {
      console.log('❌ Agent disconnected:', socket.id);
    });

    socket.on('get-next-round', () => {
      socket.emit('next-round-info', nextRoundInfo);
    });
  });

  startNewCycle();
}

// Generate round info with date-based ID and reset counter daily
function createRoundInfo(pattern) {
  const now = new Date();
  const currentDate = format(now, 'yyyyMMdd');

  if (currentDate !== lastRoundDate) {
    gameCounter = 1; // new day, reset
    lastRoundDate = currentDate;
  }

  const roundId = `${currentDate}-g${gameCounter++}`;

  return {
    round_id: roundId,
    pattern,
    round_start_time: now,
  };
}

// Start 5-pattern cycle
function startNewCycle() {
  const shuffled = [...PATTERNS].sort(() => Math.random() - 0.5);
  selectedPatterns = [...shuffled.slice(0, 4), FULL_HOUSE];
  currentPatternIndex = 0;
  console.log('🔄 New pattern cycle:', selectedPatterns);

  nextRoundInfo = createRoundInfo(selectedPatterns[currentPatternIndex]);
  startPatternGame();
}

function startPatternGame() {
  currentRoundInfo = nextRoundInfo;

  // 🔥 Immediately prepare the next round info
  const nextPatternIndex = currentPatternIndex + 1;
  if (nextPatternIndex < selectedPatterns.length) {
    nextRoundInfo = createRoundInfo(selectedPatterns[nextPatternIndex]);
  } else {
    nextRoundInfo = null; // Will be regenerated in startNewCycle
  }

  resetGame();
  const pattern = currentRoundInfo.pattern;

  console.log(`🎮 Starting round: ${currentRoundInfo.round_id} with pattern: ${pattern}`);

  io.emit('pattern-change', pattern);
  io.emit('round-start', currentRoundInfo);

  drawNext();

  drawTimer = setInterval(() => {
    if (remainingNumbers.length === 0) {
      clearInterval(drawTimer);
      io.emit('game-over', currentRoundInfo);
      console.log(`✅ Game over. Waiting ${WAIT_AFTER_GAME_MS / 1000}s...`);

      setTimeout(() => {
        currentPatternIndex++;

        if (currentPatternIndex >= selectedPatterns.length) {
          startNewCycle(); // full cycle done
        } else {
          startPatternGame(); // move to next pattern round
        }
      }, WAIT_AFTER_GAME_MS);
    } else {
      drawNext();
    }
  }, DRAW_INTERVAL);
}


// Draw next bingo number
function drawNext() {
  const index = Math.floor(Math.random() * remainingNumbers.length);
  currentNumber = remainingNumbers[index];
  remainingNumbers.splice(index, 1);
  drawnNumbers.push(currentNumber);

  io.emit('bingo-update', {
    currentNumber,
    drawnNumbers,
    remainingCount: remainingNumbers.length,
    currentPattern: currentRoundInfo?.pattern || null,
    currentRoundId: currentRoundInfo?.round_id || null,
  });

  console.log('🎱 Drawn:', currentNumber);
}

// Reset for a new round
function resetGame() {
  remainingNumbers = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);
  drawnNumbers = [];
  currentNumber = null;
}

module.exports = {
  setupBingoSocket,
  getNextRoundInfo: () => nextRoundInfo,
};
