// rooms.js
const { generateRoomCode } = require('./utils');
const { questionPairs } = require('./questions.js');

const rooms = {};

function createRoom(socket, name, avatar) {
    let code;
    do {
      code = generateRoomCode();
    } while (rooms[code]);
  
    rooms[code] = {
      code,
      leaderId: socket.id,
      originalLeaderId: socket.id,
      expectedPlayersCount: 1,
      isTransitioningToGame: false, 
      gameStartTimeout: null, 
      redirectGraceStart: null,
      players: [{ 
        socket, 
        name, 
        avatar,
        isLeader: true
      }],
      settings: {
        rounds: 4,
        answeringTime: 30,
        discussionTime: 80,
      },
      gameState: {
        started: false,
        impostor: null,
        round: -1, // Initialize to -1 to indicate lobby state
        phase: 'waiting',
        answers: new Map(),
        votes: new Map(),
        votesTallied: false,
        rolesAssigned: false
      },
    };
    
    return code;
}

function updateRoomSettings(code, settings, socketId) {
    const room = rooms[code];
    if (!room) return false;
    
    // Verify this is coming from the room leader
    if (room.leaderId !== socketId) return false;
    
    // Update settings in room object
    room.settings = {
        ...room.settings,
        ...settings
    };
    
    console.log(`Settings updated for room ${code}:`, room.settings);

    // Broadcast new settings to all players
    broadcastToRoom(code, {
        type: 'settings-updated',
        settings: room.settings
    });
    
    
    // Broadcast new settings to all players
    broadcastToRoom(code, {
        type: 'settings-updated',
        settings: room.settings
    });
    
    return true;
}

function getRoomSettings(code) {
    const room = rooms[code];
    return room ? room.settings : null;
}

function joinRoom(code, socket, name, avatar, isReconnect = false) {
    const room = rooms[code];
    if (!room) return false;
    if (room.players.length >= 6) return 'full';
    
    let shouldBeLeader = room.players.length === 0;
    
    // Remove any existing player entry with the same name
    const existingIndex = room.players.findIndex(p => p.name === name);

    if (existingIndex !== -1) {
      if (!isReconnect) {
        return 'duplicate';
      }
    
      shouldBeLeader = room.players[existingIndex].isLeader;
      room.players.splice(existingIndex, 1); // Replace old entry
    }
    
    // Add player with correct leader status
    const player = { 
        socket, 
        name, 
        avatar,
        isLeader: shouldBeLeader
    };
    
    room.players.push(player);
    
    // Update room leader ID if this player is leader
    if (shouldBeLeader) {
        room.leaderId = socket.id;
        console.log(`Setting ${name} as leader with socket ID: ${socket.id} FROM joinRoom() (length was 0)`);
    }
    
    return true;
}

function getRoomPlayers(code) {
    const room = rooms[code];
    return room
      ? room.players.map(p => ({
          name: p.name,
          avatar: p.avatar,
          isLeader: p.isLeader
        }))
      : [];
}

function broadcastToRoom(code, message) {
  const room = rooms[code];
  if (!room) return;

  room.players.forEach(({ socket }) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  });
}

function assignNewLeader(code) {
    const room = rooms[code];
    if (!room || room.players.length === 0) return false;
    
    // Reset all leader flags
    room.players.forEach(player => {
        player.isLeader = false;
    });
    
    // Assign first available player as leader
    const newLeader = room.players[0];
    newLeader.isLeader = true;
    room.leaderId = newLeader.socket.id;
    
    console.log(`New leader assigned in room ${code}: ${newLeader.name}`);
    
    // Notify all players about leadership change
    broadcastToRoom(code, {
        type: 'leader-changed',
        leaderId: room.leaderId,
        leaderName: newLeader.name,
        players: getRoomPlayers(code)
    });
    
    return true;
}

function removePlayer(socket) {
  for (const code in rooms) {
    const room = rooms[code];

    if (room.isTransitioningToGame) {
      const maybeLeader = room.players.find(p => p.socket === socket);
      if (maybeLeader && maybeLeader.name === room.originalLeaderName) {
        console.log(`[SKIP REMOVE] Leader ${maybeLeader.name} reconnecting with socket ${socket.id}`);
        return;
      }
    }

    const index = room.players.findIndex(p => p.socket === socket);

    if (index !== -1) {
      const [removed] = room.players.splice(index, 1);
      const wasLeader = room.leaderId === socket.id;

      console.log(`[REMOVE PLAYER] Socket ID: ${socket.id} | Name: ${removed.name} | Room: ${code}`);
      console.log(`[REMOVE PLAYER] Was Leader: ${wasLeader}`);
      console.log(`[REMOVE PLAYER] Remaining Players:`, room.players.map(p => `${p.name} (${p.socket.id})`));

      // Check if the disconnected player was the leader
      if (
        wasLeader &&
        room.players.length > 0 &&
        !room.isTransitioningToGame && // already prevents this once
        socket.id !== room.originalLeaderId // Prevent fallback if original leader was this
      ) {
        const newLeader = room.players[0];
        newLeader.isLeader = true;
        room.leaderId = newLeader.socket.id;

        console.log(`[LEADER CHANGE] New Leader: ${newLeader.name} | Socket ID: ${newLeader.socket.id}`);

        broadcastToRoom(code, {
          type: 'leader-changed',
          leaderId: newLeader.socket.id,
          leaderName: newLeader.name,
          players: getRoomPlayers(code)
        });

        newLeader.socket.send(JSON.stringify({
          type: 'leadership-status',
          isLeader: true
        }));
      }

      // Update game state if in progress
      if (room.gameState && room.gameState.started) {
        broadcastToRoom(code, {
          type: 'game-state',
          players: getRoomPlayers(code)
        });
      }

      broadcastToRoom(code, {
        type: 'player-left',
        name: removed.name,
        players: getRoomPlayers(code)
      });

      return;
    }
  }

  console.warn(`[REMOVE PLAYER] Socket ID not found: ${socket.id}`);
}


function findPlayerInRoom(code, name) {
    const room = rooms[code];
    if (!room) return null;
    
    if (room.deleteTimeout) {
        clearTimeout(room.deleteTimeout);
        room.deleteTimeout = null;
    }
    
    const player = room.players.find(p => p.name === name);
    
    // If room was empty and player is returning during timeout,
    // make them the new leader
    if (player && room.players.length === 1) {
        player.isLeader = true;
        room.leaderId = player.socket.id; // Make sure this is set
        console.log(`Player ${name} became leader after rejoining empty room ${code}`);
    }
    
    return player;
}

function isPlayerLeader(code, socketId) {
  const room = rooms[code];
  return room ? room.leaderId === socketId : false;
}

function selectQuestionPair() {
  const index = Math.floor(Math.random() * questionPairs.length);
  return {
    index,
    normal: questionPairs[index].normal,
    impostor: questionPairs[index].impostor,
    category: questionPairs[index].category
  };
}

function startGame(code) {
  const room = rooms[code];
  if (!room) return false;

  room.redirectGraceStart = Date.now(); // allow known clients to reconnect for a few seconds
  room.isTransitioningToGame = true;
  room.expectedPlayersCount = room.players.length;
  room.originalLeaderId = room.leaderId;
  room.originalLeaderName = room.players.find(p => p.socket.id === room.leaderId)?.name;

  if (room.gameStartTimeout) clearTimeout(room.gameStartTimeout);
  room.gameStartTimeout = setTimeout(() => {
    finalizeTransition(code);
  }, 8000);


  room.gameState = {
    ...room.gameState,
    started: true,
    round: 1,
    totalRounds: room.settings.rounds,
    impostor: null,
    phase: 'starting',
    answers: new Map(),
    votes: new Map(),
    votesTallied: false,
    rolesAssigned: true,
    currentQuestion: selectQuestionPair()
  };

  const playerIndex = Math.floor(Math.random() * room.players.length);
  const selectedQuestion = room.gameState.currentQuestion;
  
  console.log('DEBUG - Selected Question Pair:', selectedQuestion);
  console.log('DEBUG - Selected Impostor:', room.players[playerIndex].name);

  room.gameState.impostor = room.players[playerIndex].name;

  // Notify each player about their role and question
  room.players.forEach(player => {
    const isImpostor = player.name === room.gameState.impostor;
    const question = isImpostor ? selectedQuestion.impostor : selectedQuestion.normal;
    
    console.log(`DEBUG - Sending to ${player.name}:`, {
      isImpostor,
      question
    });

    player.socket.send(JSON.stringify({
      type: 'game-role',
      isImpostor,
      question,
      round: 1
    }));
  });

  return true;
}

function resetRoundState(code) {
  const room = rooms[code];
  if (!room) return false;

  room.gameState = {
    ...room.gameState,
    answers: new Map(),
    votes: new Map(),
    votesTallied: false,
    round: room.gameState.round + 1
  };

  return true;
}

function finalizeTransition(code) {
  const room = rooms[code];
  if (!room) return;

  room.isTransitioningToGame = false;
  room.gameStartTimeout = null;

  room.originalLeaderName = room.players.find(p => p.socket.id === room.leaderId)?.name;
  const originalLeader = room.players.find(p => p.name === room.originalLeaderName);

  if (originalLeader) {
    originalLeader.isLeader = true;
    room.leaderId = originalLeader.socket.id;
    console.log(`[TRANSITION] Original leader ${originalLeader.name} restored.`);
  } else if (room.players.length > 0) {
    // Fallback leader reassignment
    const newLeader = room.players[0];
    newLeader.isLeader = true;
    room.leaderId = newLeader.socket.id;
    console.log(`[TRANSITION] Fallback: new leader is ${newLeader.name}`);
  }

  broadcastToRoom(code, {
    type: 'leader-changed',
    leaderId: room.leaderId,
    players: getRoomPlayers(code)
  });

  // Notify the leader directly
  const leader = room.players.find(p => p.socket.id === room.leaderId);
  if (leader) {
    leader.socket.send(JSON.stringify({
      type: 'leadership-status',
      isLeader: true
    }));
  }
}


module.exports = {
    createRoom,
    joinRoom,
    getRoomPlayers,
    broadcastToRoom,
    removePlayer,
    findPlayerInRoom,
    isPlayerLeader,
    assignNewLeader,
    updateRoomSettings,
    getRoomSettings,
    startGame,
    resetRoundState,
    selectQuestionPair,
    finalizeTransition,
    rooms
};