const { Server } = require('socket.io');
const { format } = require('date-fns');
const crypto = require('crypto');
const pool = require('../db/db'); // PG pool connection

const MAX_NUMBER = 75;
const DRAW_INTERVAL = 10000; // 7 seconds
const WAIT_AFTER_GAME_MS = 10 * 60 * 1000; // 5 minutes

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

let gameCounter = 1;
let lastRoundDate = format(new Date(), 'yyyyMMdd');

// Track verified agents per round
const verifiedAgents = new Set();

function shufflePatterns(patterns) {
  const arr = [...patterns];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

//---------------- Ticket sales check ----------------

async function hasSoldEnoughTickets(agentId, roundId) {
  try {
    console.log(`🔍 Checking total sales for Agent: ${agentId}, Round: ${roundId}`);

    const query = `
      SELECT SUM(price) AS total_sales
      FROM tickets
      WHERE agent_id = $1 AND round_id = $2
    `;
    const values = [agentId.trim(), roundId.trim()];
    const res = await pool.query(query, values);

    const totalSales = parseFloat(res.rows[0]?.total_sales || '0');
    console.log(`💰 Agent ${agentId} sold total of $${totalSales} for round ${roundId}`);

    return totalSales >= 215;
  } catch (error) {
    console.error('❌ DB error checking ticket sales:', error);
    return false;
  }
}

//---------------- Setup Socket ----------------

function setupBingoSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on('connection', (socket) => {
    console.log('📡 Agent connected:', socket.id);

    socket.on('verify-agent', async ({ agentId }) => {
  if (!currentRoundInfo?.round_id) {
    return socket.emit('verification-result', {
      success: false,
      message: '⏳ No active round available yet.',
    });
  }

  const isEligible = await hasSoldEnoughTickets(agentId, currentRoundInfo.round_id);
  console.log('Verifying agent:', agentId, 'for round:', currentRoundInfo.round_id);

 if (!isEligible) {

socket.emit('verification-result', {
  success: false,
  message: `❌ You must sell tickets totaling at least $215 for round ${currentRoundInfo.round_id} to join.`,
  currentGame: {
    roundId: currentRoundInfo.round_id,
    pattern: currentRoundInfo.pattern,
  },
  timeUntilNextRound: (((remainingNumbers.length*1000)+WAIT_AFTER_GAME_MS)/1000),
});

}


 const key = `${agentId.trim()}-${currentRoundInfo.round_id}`;
verifiedAgents.add(key);

// Save agentId in the socket for later
socket.agentId = agentId;


  socket.emit('verification-result', {
    success: true,
    message: `✅ Verified for round ${currentRoundInfo.round_id}.`,
    data: {
      currentNumber,
      drawnNumbers,
      remainingCount: remainingNumbers.length,
      currentPattern: currentRoundInfo?.pattern || null,
      currentRoundInfo,
      nextRoundInfo,
    },
  });
});


    socket.on('get-next-round', () => {
      const agentId = socket.agentId;


      const key = `${agentId.trim()}-${currentRoundInfo.round_id}`;
      if (!verifiedAgents.has(key)) {
        return socket.emit('error', 'You must verify ticket sales before accessing game data.');
      }
      socket.emit('next-round-info', nextRoundInfo);
    });

    socket.on('get-bingo-state', () => {
      const key = `${agentId.trim()}-${currentRoundInfo.round_id}`;
      if (!verifiedAgents.has(key)) {
        return socket.emit('error', 'You must verify ticket sales before accessing game data.');
      }
      socket.emit('bingo-state', {
        currentNumber,
        drawnNumbers,
        remainingCount: remainingNumbers.length,
        currentPattern: currentRoundInfo?.pattern || null,
        currentRoundInfo,
        nextRoundInfo,
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Agent disconnected:', socket.id);
     if (socket.agentId && currentRoundInfo?.round_id) {
  const key = `${socket.agentId.trim()}-${currentRoundInfo.round_id}`;
  verifiedAgents.delete(key);
}

    });
  });

  startNewCycle();
}

//---------------- Round Utilities ----------------

async function createRoundInfo(pattern) {
  const now = new Date();
  const currentDate = format(now, 'yyyyMMdd');

  if (currentDate !== lastRoundDate) {
    gameCounter = 1; // Reset for a new day
    lastRoundDate = currentDate;

    // Fetch the latest round from DB for the new date
    const query = `
      SELECT round_id FROM tickets
      WHERE round_id LIKE $1
      ORDER BY round_id DESC
      LIMIT 1
    `;
    const datePrefix = `${currentDate}-%`;
    try {
      const result = await pool.query(query, [datePrefix]);
      if (result.rows.length > 0) {
        const latestRoundId = result.rows[0].round_id;
        const match = latestRoundId.match(/g(\d+)$/);
        if (match) {
          gameCounter = parseInt(match[1], 10) + 1;
        }
      }
    } catch (err) {
      console.error('❌ Error checking latest round:', err);
    }
  }

  const roundId = `${currentDate}-g${gameCounter++}`;
  return {
    round_id: roundId,
    pattern,
    round_start_time: now,
  };
}


async function prepareNextCycle() {
  const shuffled = shufflePatterns(PATTERNS);
  selectedPatterns = [...shuffled.slice(0, 4), FULL_HOUSE];
  currentPatternIndex = 0;
  nextRoundInfo = await createRoundInfo(selectedPatterns[currentPatternIndex]);
}


async function startNewCycle() {
  await prepareNextCycle();
  startPatternGame();
}


//---------------- Game Flow ----------------

function startPatternGame() {
  currentRoundInfo = nextRoundInfo;
  verifiedAgents.clear();

  resetGame();

  const pattern = currentRoundInfo.pattern;
  console.log(`🎮 Starting round: ${currentRoundInfo.round_id} with pattern: ${pattern}`);

  // Send game start events
  io.emit('pattern-change', pattern);
  io.emit('round-start', currentRoundInfo);
  io.emit('round-ready', currentRoundInfo.round_id);

  // 👇 Increment index now (before draw starts)
  currentPatternIndex++;

  // Prepare next round in advance
  if (currentPatternIndex < selectedPatterns.length) {
    nextRoundInfo = createRoundInfo(selectedPatterns[currentPatternIndex]);
  } else {
      prepareNextCycle(); 
  }

  // Start drawing numbers
  drawNext();

  drawTimer = setInterval(() => {
    if (remainingNumbers.length === 0) {
      clearInterval(drawTimer);
      io.emit('game-over', currentRoundInfo);
      console.log(`✅ Game over. Waiting ${WAIT_AFTER_GAME_MS / 1000}s...`);

      setTimeout(async () => {
        // If current cycle is over, prepare a new cycle
        if (currentPatternIndex >= selectedPatterns.length) {
          await prepareNextCycle();      // sets selectedPatterns and resets currentPatternIndex = 0
          currentPatternIndex = 0;
        }

        startPatternGame();
      }, WAIT_AFTER_GAME_MS);
    } else {
      drawNext();
    }
  }, DRAW_INTERVAL);
}


//---------------- Game Mechanics ----------------

function drawNext() {
  const index = crypto.randomInt(remainingNumbers.length);
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
}

function resetGame() {
  remainingNumbers = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);
  drawnNumbers = [];
  currentNumber = null;
}

//---------------- Exports ----------------

module.exports = {
  setupBingoSocket,
  getNextRoundInfo: () => nextRoundInfo,
};
