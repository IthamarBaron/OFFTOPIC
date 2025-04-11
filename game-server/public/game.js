let wsReady = false;
let currentTimer = null;  // Add at the top of the file to store timer reference
let currentPlayers = [];  // Add at the top of the file with other globals
let votedPlayers = new Set(); // Add at the top with other global variables

const ws = new WebSocket(
  location.protocol === 'https:' 
    ? 'wss://' + location.host 
    : 'ws://' + location.host
)

// Load data from sessionStorage (required for reconnection)
const roomCode = sessionStorage.getItem("roomCode") || "XXXX";
const playerName = sessionStorage.getItem("playerName") || null;
const playerAvatar = sessionStorage.getItem("playerAvatar") || null;
const gameSettings = JSON.parse(sessionStorage.getItem("gameSettings") || '{}');

// Debug print to ensure values are valid
console.log("[game.js] Joining game with:", { roomCode, playerName, playerAvatar, gameSettings });

ws.onopen = () => {
  console.log("WebSocket open in game.html");
  wsReady = true;

  if (roomCode && playerName && playerAvatar) {
    const payload = {
      type: "join-game",
      code: roomCode,
      name: playerName,
      avatar: playerAvatar,
      isReconnect: true
    };
    console.log("Sending join-game payload:", payload);
    ws.send(JSON.stringify(payload));
  } else {
    console.warn("Missing game data, redirecting...");
    window.location.href = "/";
  }

  // Store socket ID when connection opens
  sessionStorage.setItem('socketId', ws.id);
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log("[game.js] Message received:", msg);

  if (msg.type === 'force-exit') {
    alert("You refreshed during the game. That's on you.");
    window.location.href = "/";
  }

  if (msg.type === "game-state") {
    console.log("Updating player list:", msg.players);
    currentPlayers = msg.players;
    renderPlayers(msg.players);
  
    if (msg.settings) {
      Object.assign(gameSettings, msg.settings);
      sessionStorage.setItem('gameSettings', JSON.stringify(gameSettings));
    }
  }

  if (msg.type === "player-left") {
    console.log("Player left:", msg.name);
    addGameLog(`• ${msg.name} Has left the game, You might have to wait for the time to ran out`);
    currentPlayers = msg.players; // Update our local player list
    renderPlayers(msg.players);
  }

  if (msg.type === "error") {
    alert(msg.message);
    //window.location.href = "/";
  }

  if (msg.type === 'game-role') {

    if (currentTimer) {
      currentTimer();
      currentTimer = null;
    }
  
    // Clear the main section first
    const mainSection = document.querySelector('main');
    mainSection.className = 'flex flex-col lg:flex-row w-full max-w-6xl mt-8 gap-6 z-10';
    mainSection.innerHTML = `
      <!-- Player List (desktop only) -->
      <aside class="hidden lg:block w-1/4 bg-[#2a2a2a] rounded-xl p-4 self-start sticky top-4">
        <h2 class="text-lg font-semibold text-lime-400 mb-3">Players</h2>
        <div id="players" class="flex flex-col gap-4 items-center">
          <!-- Filled by JS -->
        </div>
      </aside>
  
      <!-- Game Panel -->
      <section class="lg:w-3/4">
        <div class="bg-[#2a2a2a] p-6 rounded-xl shadow-lg">
          <div class="max-w-xl mx-auto">
            <h2 id="question" class="text-2xl font-bold text-lime-300 mb-6 text-center">Waiting for question...</h2>
            <div class="w-full h-4 bg-gray-700 rounded-full overflow-hidden mb-6">
              <div id="timer-bar" class="h-full bg-green-400 transition-all duration-300 ease-linear" style="width: 100%;"></div>
            </div>
            <textarea id="answer-input" rows="4" placeholder="Type your answer..." 
              class="w-full bg-[#1a1a1a] border border-gray-600 rounded-lg p-4 text-white resize-none mb-1 focus:outline-none focus:ring-2 focus:ring-lime-400"
              maxlength="50"></textarea>
            <div class="text-right text-sm text-gray-400 pr-1 mb-3" id="char-counter">0 / 50</div>
            <div class="flex justify-center">
              <button id="send-answer" 
                class="bg-[#A8FF60] text-black font-bold py-2 px-6 rounded-lg hover:bg-[#B2FF70] transition disabled:opacity-50 disabled:cursor-not-allowed">
                Send
              </button>
            </div>
          </div>
        </div>
      </section>
    `;
  
    // Add event listener for sending answer
    document.getElementById('send-answer').addEventListener('click', submitAnswer);
  
    // Add character counter logic
    const answerInput = document.getElementById('answer-input');
    const charCounter = document.getElementById('char-counter');
  
    answerInput.addEventListener('input', () => {
      const length = answerInput.value.length;
      charCounter.textContent = `${length} / 50`;
  
      if (length >= 50) {
        charCounter.classList.add('text-red-400', 'shake');
      } else {
        charCounter.classList.remove('text-red-400', 'shake');
      }
    });
  
    // Re-render the player list
    if (currentPlayers.length > 0) {
      renderPlayers(currentPlayers);
    }
  
    // Store role information
    sessionStorage.setItem('isImpostor', msg.isImpostor);
    sessionStorage.setItem('currentQuestion', msg.question);
  
    // Show role notification and then question
    showRoleNotification(msg.isImpostor);
    setTimeout(() => {
      console.log('DEBUG - Showing question from timeout:', msg.question);
      showQuestion(msg.question);
      const storedSettings = JSON.parse(sessionStorage.getItem('gameSettings') || '{}');
      const answerTime = storedSettings.answeringTime || 30;
      if (currentTimer) {
        currentTimer();
        currentTimer = null;
      }
      currentTimer = startAnswerTimer(answerTime);
    }, 3500);
  
    // Reset any stored vote data
    votedPlayers.clear();
  }

  if (msg.type === 'show-answers') {
    // Stop answer timer if running
    if (currentTimer) {
        currentTimer();
    }
    
    console.log('DEBUG - Showing answers:', msg); // Add debug log
    showAnswers(
      msg.answers,
      msg.originalQuestion,
      msg.impostorQuestion,
      msg.impostor,
      msg.round,
      msg.totalRounds
    );

    // Use discussion time from room settings
    const storedSettings = JSON.parse(sessionStorage.getItem('gameSettings') || '{}');
    const discussionTime = storedSettings.discussionTime || 80;
    if (currentTimer) {
      currentTimer();
      currentTimer = null;
    }
    currentTimer = startDiscussionTimer(discussionTime)}

  // Add handler for answer status updates
  if (msg.type === 'answer-status') {
    const questionElement = document.getElementById('question');
    // Only update text if this player has submitted their answer
    if (document.getElementById('answer-input').disabled) {
      questionElement.textContent = `Waiting for other players... (${msg.submitted}/${msg.total})`;
    }
  }

  if (msg.type === 'vote-update') {
    votedPlayers.add(msg.voter); // Add voter to the set
    addGameLog(`• ${msg.voter} voted for ${msg.target}`);
    updateVoteIndicators();
  }

  if (msg.type === 'vote-results') {
    handleVoteResults(msg);
  }

  if (msg.type === 'game-over') {
    // Store leadership status if player was leader
    if (msg.isLeader) {
        sessionStorage.setItem('isLeader', 'true');
        sessionStorage.setItem('wasLeader', 'true');
    }
    
    // Store room state before redirect
    sessionStorage.setItem('roomState', JSON.stringify({
        code: roomCode,
        playerName: playerName,
        playerAvatar: playerAvatar,
        isLeader: msg.isLeader
    }));

    const mainSection = document.querySelector('main');
    mainSection.innerHTML = `
        <div class="w-full max-w-6xl mx-auto">
            <div class="bg-[#2a2a2a] p-8 rounded-xl shadow-lg text-center">
                <h2 class="text-3xl font-bold text-[#A8FF60] mb-4">Game Over!</h2>
                <p class="text-gray-400 text-lg mb-8">All ${msg.totalRounds} rounds completed</p>
                <button onclick="returnToLobby()" 
                    class="bg-[#A8FF60] hover:bg-[#B2FF70] text-black font-bold py-3 px-6 rounded-lg transition-colors">
                    Return to Lobby
                </button>
            </div>
        </div>
    `;
  }

  // Add handler for leadership status
  if (msg.type === 'leadership-status') {
    console.log('Received leadership status:', msg);
    sessionStorage.setItem('isLeader', msg.isLeader);
    updateLeaderControls();
  }

  // Add handler for leader changes
  if (msg.type === 'leader-changed') {
    console.log('Leader changed:', msg);
    sessionStorage.setItem('isLeader', msg.leaderId === ws.id);
    updateLeaderControls();
  }

  // Add handler for settings updates
  if (msg.type === 'settings-updated') {
    console.log('Updating game settings:', msg.settings);
    // Update local gameSettings object
    Object.assign(gameSettings, msg.settings);
    sessionStorage.setItem('gameSettings', JSON.stringify(gameSettings));
    
    // If we're in a game phase, update timers with new settings
    if (currentTimer) {
        currentTimer(); // Stop current timer
        if (document.getElementById('timer-bar')) {
            // We're in answer phase
            const storedSettings = JSON.parse(sessionStorage.getItem('gameSettings') || '{}');
            const answerTime = storedSettings.answeringTime || 30;
            currentTimer = startAnswerTimer(gameSettings.answeringTime);
        } else if (document.getElementById('discussion-timer-bar')) {
            // We're in discussion phase
            const storedSettings = JSON.parse(sessionStorage.getItem('gameSettings') || '{}');
            const discussionTime = storedSettings.discussionTime || 80;
            currentTimer = startDiscussionTimer(discussionTime);
        }
    }
  }
};

function renderPlayers(players) {
  if (!players || !Array.isArray(players)) {
    console.error("Invalid players data:", players);
    return;
  }

  const container = document.getElementById("players");
  container.innerHTML = ""; // Clear existing players

  if (players.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "text-gray-400 text-sm text-center";
    emptyMessage.textContent = "No players connected";
    container.appendChild(emptyMessage);
    return;
  }

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "flex flex-col items-center w-full";

    const imgContainer = document.createElement("div");
    imgContainer.className = "relative mb-2";

    const img = document.createElement("img");
    img.src = `/avatars/${p.avatar}`;
    img.className = "w-20 h-auto rounded-full border-2 border-lime-400";
    img.onerror = () => {
      img.src = "/avatars/Avatar1.png"; // fallback avatar
    };

    imgContainer.appendChild(img);
    div.appendChild(imgContainer);

    const nameContainer = document.createElement("div");
    nameContainer.className = "flex items-center gap-1 text-center";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = p.name;
    nameSpan.className = "text-sm";

    nameContainer.appendChild(nameSpan);

    // Add "You" indicator
    if (p.name === playerName) {
      const youBadge = document.createElement("span");
      youBadge.textContent = "(You)";
      youBadge.className = "text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded";
      nameContainer.appendChild(youBadge);
    }

    div.appendChild(nameContainer);
    container.appendChild(div);
  });
}

function showCountdown(callback) {
  const overlay = document.getElementById("countdown-overlay");
  const number = document.getElementById("countdown-number");

  let count = 3;
  overlay.classList.remove("hidden");

  const interval = setInterval(() => {
    number.textContent = count;
    number.classList.remove("scale-75", "opacity-0");
    number.classList.add("scale-100", "opacity-100");

    setTimeout(() => {
      number.classList.remove("scale-100", "opacity-100");
      number.classList.add("scale-75", "opacity-0");
    }, 600);

    count--;
    if (count < 0) {
      clearInterval(interval);
      overlay.classList.add("hidden");
      if (callback && wsReady) callback();  // Only execute callback if WS is ready
    }
  }, 1000);
}

showCountdown(() => {
  console.log("Countdown done! Start game logic here.");
});

function showRoleNotification(isImpostor) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center';

  const question = sessionStorage.getItem('currentQuestion') || 'Your question will appear here...';

  const content = document.createElement('div');
  content.className = 'text-center p-8 rounded-xl';

  content.innerHTML = `
    <h2 class="text-3xl font-bold text-[#A8FF60] mb-4">Your Question</h2>
    <p class="text-lg text-white max-w-md mx-auto bg-[#1a1a1a] p-4 rounded-lg">${question}</p>
  `;

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  // Hide after 2.5 seconds
  setTimeout(() => {
    overlay.classList.add('opacity-0');
    setTimeout(() => overlay.remove(), 500);
  }, 2800);
}

function showQuestion(question) {
  console.log('DEBUG - showQuestion called with:', question);
  
  const questionElement = document.getElementById('question');
  if (!question) {
    console.error('DEBUG - No question received!');
    question = 'Error loading question...';
  }
  
  questionElement.textContent = question;
  
  // Enable the answer input
  const answerInput = document.getElementById('answer-input');
  answerInput.value = '';
  answerInput.disabled = false;
  answerInput.placeholder = "Type your answer...";
  
  // Start the timer and store the cancel function
  const storedSettings = JSON.parse(sessionStorage.getItem('gameSettings') || '{}');
  const answerTime = storedSettings.answeringTime || 30;
  console.log('DEBUG - Starting timer for', answerTime, 'seconds');
  currentTimer = startAnswerTimer(answerTime);
}

function startAnswerTimer(seconds) {
  const timerBar = document.getElementById('timer-bar');
  const startTime = Date.now();
  const duration = seconds * 1000;
  let timerRunning = true;

  function updateTimer() {
    if (!timerRunning) return;
    
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, duration - elapsed);
    const percentage = (remaining / duration) * 100;
    
    timerBar.style.width = `${percentage}%`;
    
    if (remaining > 0) {
      requestAnimationFrame(updateTimer);
    } else {
      submitAnswer(true);  // Force submit when timer expires
    }
  }

  updateTimer();
  return () => { timerRunning = false; };
}

function submitAnswer(forced = false) {
  const answerInput = document.getElementById('answer-input');
  const submitButton = document.getElementById('send-answer');
  const questionElement = document.getElementById('question');
  let answer = answerInput.value.trim();
  
  // Handle empty answers
  if (!answer) {
    answer = "empty answer";
  }
  
  console.log('DEBUG - Submitting answer:', {
    roomCode,
    playerName,
    answer,
    forced
  });
  
  ws.send(JSON.stringify({
    type: 'submit-answer',
    code: roomCode,
    name: playerName,
    answer: answer,
    forced: forced
  }));
  
  // Disable input and button after submission
  answerInput.disabled = true;
  submitButton.disabled = true;
  submitButton.classList.add('opacity-50', 'cursor-not-allowed');
  
  // Create status message above the input
  const statusDiv = document.createElement('div');
  statusDiv.className = 'text-green-400 text-sm mb-2 text-center';
  statusDiv.textContent = '✓ Answer submitted';
  answerInput.parentNode.insertBefore(statusDiv, answerInput);
}

function showAnswers(answers, originalQuestion, impostorQuestion, impostor, round, totalRounds) {
  const mainSection = document.querySelector('main');
  
  // Create discussion phase layout
  const discussionLayout = document.createElement('div');
  discussionLayout.className = 'w-full max-w-6xl mx-auto';
  
  // Update timer section with round counter
  const timerSection = document.createElement('div');
  timerSection.className = 'mb-8 text-center';
  timerSection.innerHTML = `
    <div class="text-2xl font-bold text-[#A8FF60] mb-2">Discussion Phase</div>
    <p class="text-gray-400 mt-2 mb-1">Round ${round}/${totalRounds}</p>
    <p class="text-gray-400 mb-4 text-lg">Time To Vote Who Is <span class="text-[#A8FF60]">Off Topic!</span></p>
    <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
      <div id="discussion-timer-bar" class="h-full bg-[#A8FF60] transition-all duration-300 ease-linear" style="width: 100%"></div>
    </div>
  `;

  // Questions Panel - Only show original question
  const questionsPanel = document.createElement('div');
  questionsPanel.className = 'mb-8 bg-[#2a2a2a] p-6 rounded-xl shadow-lg';
  questionsPanel.innerHTML = `
    <div class="text-center">
      <p class="text-[#A8FF60] font-medium mb-2">Question:</p>
      <p class="text-xl bg-[#1a1a1a] p-4 rounded-lg">${originalQuestion}</p>
    </div>
  `;

  // Players & Answers Section
  const answersSection = document.createElement('div');
  answersSection.className = 'mb-8';
  answersSection.innerHTML = `
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  ${answers.map(([name, answer]) => {
    const playerData = currentPlayers.find(p => p.name === name) || { avatar: 'Avatar1.png' };
    return `
      <div class="player-card bg-[#2a2a2a] p-4 rounded-xl shadow-lg transition-all hover:shadow-xl flex flex-col justify-between" data-player-name="${name}">
        <div class="flex justify-between items-center flex-wrap gap-2 mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="relative flex-shrink-0">
              <img src="/avatars/${playerData.avatar}" class="w-10 h-10 rounded-full border-2 border-[#A8FF60]">
              <div class="vote-indicator absolute -top-1 -right-1 flex items-center"></div>
            </div>
            <div class="flex items-center gap-1 min-w-0 truncate">
              <span class="font-medium text-white truncate max-w-[8rem] sm:max-w-[10rem]">${name}</span>
              ${name === playerName ? '<span class="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">(You)</span>' : ''}
            </div>
          </div>
          <button class="vote-button px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-full transition-colors whitespace-nowrap"
                  onclick="handleVote('${name}')">
            Vote
          </button>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-lg text-gray-300 text-sm break-words leading-snug max-h-32 overflow-y-auto">
          "${answer}"
        </div>
      </div>
    `;
  }).join('')}
</div>
  `;

  // Game Log
  const gameLog = document.createElement('div');
  gameLog.className = 'bg-[#1a1a1a] rounded-xl p-4 h-40 overflow-y-auto font-mono text-sm';
  gameLog.innerHTML = `
    <div class="text-gray-450">• Discussion phase started</div>
    <div class="text-gray-450">• All answers revealed</div>
    <div class="text-gray-450">• Time to identify who got a different question...</div>
  `;
  gameLog.id = 'game-log';

  // Assemble the layout
  discussionLayout.appendChild(timerSection);
  discussionLayout.appendChild(questionsPanel);
  discussionLayout.appendChild(answersSection);
  discussionLayout.appendChild(gameLog);

  // Clear existing content and show new layout
  mainSection.innerHTML = '';
  mainSection.appendChild(discussionLayout);

  const storedSettings = JSON.parse(sessionStorage.getItem('gameSettings') || '{}');
  const discussionTime = storedSettings.discussionTime || 80;
  currentTimer = startDiscussionTimer(discussionTime);
}

function startDiscussionTimer(seconds) {
  const timerBar = document.getElementById('discussion-timer-bar');
  const startTime = Date.now();
  const duration = seconds * 1000;
  let timerRunning = true;

  function updateTimer() {
    if (!timerRunning) return;
    
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, duration - elapsed);
    const percentage = (remaining / duration) * 100;
    
    timerBar.style.width = `${percentage}%`;
    
    if (percentage < 25) {
      timerBar.classList.remove('bg-[#A8FF60]');
      timerBar.classList.add('bg-red-500');
    }
    
    if (remaining > 0 && timerRunning) {
      requestAnimationFrame(updateTimer);
    } else if (timerRunning) {
      // Time's up - notify server only if timer is still running
      ws.send(JSON.stringify({
        type: 'discussion-time-up',
        code: roomCode
      }));
      timerRunning = false; // Prevent multiple time-up messages
    }
  }

  updateTimer();
  return () => { timerRunning = false; };
}

function addGameLog(message) {
  const gameLog = document.getElementById('game-log');
  if (gameLog) {
    const logEntry = document.createElement('div');
    logEntry.className = 'text-gray-200';
    logEntry.textContent = message;
    gameLog.appendChild(logEntry);
    gameLog.scrollTop = gameLog.scrollHeight; // Auto-scroll to bottom
  }
}

function handleVote(targetName) {
  // Disable all vote buttons
  const voteButtons = document.querySelectorAll('.vote-button');
  voteButtons.forEach(btn => {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
  });

  // Send vote to server
  ws.send(JSON.stringify({
    type: 'submit-vote',
    code: roomCode,
    name: playerName,
    target: targetName
  }));

  addGameLog(`• You voted for ${targetName}`);
}

function handleVoteResults(results) {
  // Stop the discussion timer if it's running
  if (currentTimer) {
    currentTimer();
    currentTimer = null;
  }

  // First log the results to game console
  if (results.isDraw) {
    addGameLog('• Vote ended in a draw! No one was voted off.');
  } else {
    addGameLog(`• ${results.votedPlayer} was voted off!`);
    if (results.wasImpostor) {
      addGameLog('• The Impostor was caught!');
    } else {
      addGameLog('• They were innocent!');
    }
  }

  // Then show the results screen
  showResultsScreen(results);
}

function showResultsScreen(results) {
  const mainSection = document.querySelector('main');
  
  const resultsLayout = document.createElement('div');
  resultsLayout.className = 'w-full max-w-6xl mx-auto';
  
  resultsLayout.innerHTML = `
    <div class="bg-[#2a2a2a] p-8 rounded-xl shadow-lg text-center">
      <!-- Results Header -->
      <div class="mb-8">
        <h2 class="text-3xl font-bold ${results.isDraw ? 'text-gray-400' : (results.wasImpostor ? 'text-[#A8FF60]' : 'text-red-400')} mb-4">
          ${results.isDraw ? 'No Decision!' : (results.wasImpostor ? 'Impostor Caught!' : 'Wrong Person Voted Out!')}
        </h2>
          <p class="text-gray-400 text-lg">
            <span class="text-red-400">${results.impostor}</span> <span class="text-white">was the Impostor!</span>
          </p>
      </div>

      <!-- Questions Reveal -->
      <div class="grid grid-cols-2 gap-6 mb-8">
        <div class="bg-[#1a1a1a] p-4 rounded-lg text-left">
          <p class="text-[#A8FF60] font-medium mb-2">Original Question:</p>
          <p class="text-lg text-white">${results.originalQuestion || 'Question not available'}</p>
        </div>
        <div class="bg-[#1a1a1a] p-4 rounded-lg text-left">
          <p class="text-red-400 font-medium mb-2">Impostor Question:</p>
          <p class="text-lg text-white">${results.impostorQuestion || 'Question not available'}</p>
        </div>
      </div>

      <!-- Vote Summary -->
      <div class="bg-[#1a1a1a] p-4 rounded-lg mb-8">
        <h3 class="text-[#A8FF60] font-medium mb-4">Vote Summary</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl mx-auto text-sm">
          ${results.votes.map(([voter, target]) => `
            <div class="flex items-center justify-center gap-2 px-2 py-2 bg-[#2a2a2a] rounded-lg">
              <span class="text-white font-medium truncate">${voter}</span>
              <span class="text-gray-400">→</span>
              <span class="text-white truncate">${target}</span>
            </div>
          `).join('')}
        </div>
        ${!results.isDraw ? `
          <div class="mt-4 pt-4 border-t border-gray-700">
            <p class="text-white">
              <span class="font-medium">${results.votedPlayer}</span> was voted out
            </p>
          </div>
        ` : ''}
      </div>

      <!-- Player List -->
      <div class="flex justify-center flex-wrap gap-4 p-4">
        ${currentPlayers.map(player => `
          <div class="flex flex-col items-center w-16 text-center text-xs gap-1">
            <div class="relative">
              <img src="/avatars/${player.avatar}" 
                    class="w-12 h-12 object-cover rounded-full border-2 ${
                      player.name === results.impostor
                        ? 'border-red-400'
                        : player.name === results.votedPlayer
                        ? 'border-yellow-400'
                        : 'border-[#A8FF60]'
                    }"
                  />
              ${player.name === results.impostor ? 
                '<div class="absolute -top-1 -right-1 text-xs"></div>' : ''}
            </div>
            <span class="text-sm text-white font-medium">${player.name}</span>
          </div>
        `).join('')}
      </div>

      <!-- Next Round Button (Leader Only) -->
      <div class="mt-8">
        <button 
          id="next-round-button"
          class="${isLeaderInRoom() ? 'bg-[#A8FF60] hover:bg-[#B2FF70] text-black' : 'bg-gray-700 text-gray-400 cursor-not-allowed'} 
          font-bold py-3 px-6 rounded-lg transition-colors"
          ${!isLeaderInRoom() ? 'disabled' : ''}
          onclick="startNextRound()"
        >
          ${isLeaderInRoom() ? 'Start Next Round' : 'Waiting for leader...'}
        </button>
      </div>
    </div>
  `;

  // Clear main section and show results
  mainSection.innerHTML = '';
  mainSection.appendChild(resultsLayout);
}

// Add helper function to check if current player is leader
function isLeaderInRoom() {
  return sessionStorage.getItem('isLeader') === 'true';
}

// Add function to handle next round
function startNextRound() {
  if (!isLeaderInRoom()) {
    alert('Only the lobby leader can start a new round.');
    return;
  }

  ws.send(JSON.stringify({
    type: 'start-next-round',
    code: roomCode
  }));
}

function updateVoteIndicators() {
  const playerCards = document.querySelectorAll('.player-card');
  playerCards.forEach(card => {
    const playerName = card.dataset.playerName;
    const indicatorContainer = card.querySelector('.vote-indicator');
    
    if (votedPlayers.has(playerName) && !indicatorContainer.querySelector('.voted-badge')) {
      const votedBadge = document.createElement('span');
      votedBadge.className = 'voted-badge text-xs bg-gray-700 text-white px-1.5 py-0.5 rounded flex items-center gap-1';
      votedBadge.innerHTML = '<span class="text-[#A8FF60]">✓</span> Voted';
      indicatorContainer.appendChild(votedBadge);
    }
  });
}

function returnToLobby() {
  const wasLeader = sessionStorage.getItem('isLeader') === 'true';
  sessionStorage.setItem('wasLeader', wasLeader.toString());
  
  sessionStorage.setItem('roomState', JSON.stringify({
      code: roomCode,
      playerName,
      playerAvatar
  }));

  window.location.href = "/lobby.html";
}

// Add this function to update any leader-specific UI
function updateLeaderControls() {
  const nextRoundButton = document.getElementById('next-round-button');
  if (nextRoundButton) {
    const isLeader = sessionStorage.getItem('isLeader') === 'true';
    nextRoundButton.disabled = !isLeader;
    nextRoundButton.className = isLeader ? 
      'bg-[#A8FF60] hover:bg-[#B2FF70] text-black font-bold py-3 px-6 rounded-lg transition-colors' : 
      'bg-gray-700 text-gray-400 cursor-not-allowed font-bold py-3 px-6 rounded-lg transition-colors';
    nextRoundButton.innerHTML = isLeader ? 'Start Next Round' : 'Waiting for leader...';
  }
}
