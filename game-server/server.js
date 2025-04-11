const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');



// Our room logic
const {
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
  rooms,
  startGame,
  selectQuestionPair,
  finalizeTransition
} = require('./rooms');
const { debug } = require('console');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
  console.log('New client connected.');
  
  // Assign a unique ID to each socket
  ws.id = Math.random().toString(36).substr(2, 9);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const { type, name, code, avatar } = message;

      switch (type) {
        case 'create-room': {
            
            if (!name || name.trim().length === 0) {
                ws.send(JSON.stringify({ type: 'error', message: 'Name cannot be empty.' }));
                break;
            }
            
            const newCode = createRoom(ws, name, avatar);
            ws.send(JSON.stringify({
              type: 'room-created',
              code: newCode,
              players: getRoomPlayers(newCode),
              isLeader: true 
          }));
          break;
        }

        case 'join-room': {
          if (!name || name.trim().length === 0 || name.trim().length > 15) {
              ws.send(JSON.stringify({ type: 'error', message: 'Name Is Invalid.' }));
              break;
          }
      
          const room = rooms[code];
          if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
              break;
          }
      
          // Check if game is in progress (round > -1)
          if (room.gameState.round > -1) {
              ws.send(JSON.stringify({ 
                  type: 'error', 
                  message: 'Cannot join, game in progress.' 
              }));
              break;
          }
      
          const wasLeader = message.wasLeader === true;
          
          const isReconnect = message.wasReconnect === true || message.wasLeader === true;
          const result = joinRoom(code, ws, name, avatar, isReconnect);
          
          if(result === 'duplicate') {
            ws.send(JSON.stringify({ type: 'error', message: 'Name already taken in this room.' }));
            break;
          }
          if (result === true) {
              const player = room.players.find(p => p.name === name);
              
              // Restore leadership if applicable
              if (wasLeader && player) {
                  room.leaderId = ws.id;
                  player.isLeader = true;
                  
                  broadcastToRoom(code, {
                      type: 'leader-changed',
                      leaderId: ws.id,
                      leaderName: name,
                      players: getRoomPlayers(code)
                  });
              }

              // Send current room settings to the joining player
              ws.send(JSON.stringify({
                  type: 'settings-updated',
                  settings: room.settings
              }));

              broadcastToRoom(code, {
                  type: 'player-joined',
                  code,
                  players: getRoomPlayers(code)
              });
      
              if (player && player.isLeader) {
                  ws.send(JSON.stringify({
                      type: 'leadership-status',
                      isLeader: true
                  }));
              }
          }
          break;
      }
        
        case 'reconnect': {
            const player = findPlayerInRoom(code, name);
            if (player) {
                // Save the original isLeader status before updating the socket
                const wasLeader = player.isLeader;
                player.socket = ws;
                
                // If they were leader, reassign the room's leaderId 
                if (wasLeader) {
                    const room = rooms[code]; // Add this line to access the room
                    room.leaderId = ws.id;    // Update leader ID to match new socket
                    player.isLeader = true;   // Ensure isLeader is still true
                    console.log(`Leader ${name} reconnected to room ${code} with new socket ID: ${ws.id}`);
                }
        
                console.log(`Player ${name} reconnected to room ${code}. Leader status: ${player.isLeader}`);
        
                // Broadcast updated player list to everyone
                broadcastToRoom(code, {
                    type: 'player-joined',
                    code,
                    players: getRoomPlayers(code),
                });
                
                // Send leader status specifically to this player
                ws.send(JSON.stringify({
                    type: 'leadership-status',
                    isLeader: player.isLeader
                }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Reconnect failed. Player not found.' }));
            }
            break;
        }
        case 'update-settings': {
            const room = rooms[code]; // Add this line to define room
            if (isPlayerLeader(code, ws.id)) {
                const success = updateRoomSettings(code, message.settings, ws.id);
                
                if (success) {
                    // Broadcast to all clients and store in room
                    broadcastToRoom(code, {
                        type: 'settings-updated',
                        settings: message.settings
                    });
                } else {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Failed to update settings.' 
                    }));
                }
            }
            break;
        }
        
        case 'start-game': {
            if (isPlayerLeader(code, ws.id)) {
              const success = startGame(code);
              if (success) {
                const room = rooms[code];
                setTimeout(() => {
                  broadcastToRoom(code, { 
                    type: 'redirect-to-game',
                    settings: room.settings 
                  });
                }, 300)
              } else {
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  message: 'Failed to start game.' 
                }));
              }
            } else {
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Only the leader can start the game.' 
              }));
            }
            break;
          }
    
          case 'join-game': {
            const { name, code, avatar, isReconnect } = message;
            const room = rooms[code];
          
            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
              return;
            }
          
            let player = findPlayerInRoom(code, name);
            const isInGracePeriod = Date.now() - room.redirectGraceStart < 4000;

            if (!player) {
              if (room.gameState.started && !isInGracePeriod) {
                console.log(`[JOIN-GAME BLOCKED] ${name} tried to join mid-game. Redirecting.`);
                ws.send(JSON.stringify({
                  type: 'force-exit',
                  reason: 'Game already started. You cannot rejoin.'
                }));
                return;
              }
            
              // If within grace, we let them back in
              player = { name, avatar: avatar || "Avatar1.png", socket: ws, isLeader: false };
              room.players.push(player);
              console.log(`[JOIN-GAME] New player added: ${name} to room ${code}`);
            } else {
              // Known player rejoining
              player.socket = ws;
              if (avatar) player.avatar = avatar;
              console.log(`[JOIN-GAME] Player ${name} reconnected to room ${code}`);
            }
            
            // Check if all players have rejoined after transition
            if (room.isTransitioningToGame) {
              console.log(`[JOIN-GAME] Players in game: ${room.players.length}/${room.expectedPlayersCount}`);
              if (room.players.length >= room.expectedPlayersCount) {
                finalizeTransition(code);
              }
            }
          
            // Send game state first
            broadcastToRoom(code, {
              type: 'game-state',
              players: getRoomPlayers(code),
              settings: getRoomSettings(code)
            });
          
            // If roles were already assigned, send role to reconnecting player
            if (room.gameState.rolesAssigned) {
              const isImpostor = room.gameState.impostor === name;
              const question = isImpostor ? 
                room.gameState.currentQuestion.impostor : 
                room.gameState.currentQuestion.normal;

          
              ws.send(JSON.stringify({
                type: 'game-role',
                isImpostor,
                question,
                round: room.gameState.round
              }));
            }
          
            break;
          }

          case 'submit-answer': {
            const room = rooms[code];
            if (!room || !room.gameState.started) {
              ws.send(JSON.stringify({ type: 'error', message: 'Game not in progress.' }));
              break;
            }
          
            // Identify the player securely by socket
            const player = room.players.find(p => p.socket === ws);
            if (!player || !player.name) {
              ws.send(JSON.stringify({ type: 'error', message: 'You are not in this room.' }));
              return;
            }  

            // Make sure a player doent send answer for somone else in the room
            if (message.name && message.name !== player.name) {
              ws.send(JSON.stringify({ type: 'error', message: 'You cannot submit an answer for another player.' }));
              return;
            }

            // Prevent duplicate answers
            if (room.gameState.answers.has(player.name)) {
              return;
            }
            
            // Validate answer
            let answer = message.answer;
            if (typeof answer !== 'string') {
              ws.send(JSON.stringify({ type: 'error', message: 'Answer must be a fucking string.' }));
              return;
            }

            // Sanitize: strip all HTML tags to block Cross Site Scripting attacks
            answer = answer.replace(/<\/?[^>]+(>|$)/g, "").trim();

            // Length limit
            if (answer.length > 50) {
              answer = answer.trim().substring(0,50);
            }

            // Store the answer
            room.gameState.answers.set(player.name, answer);
            console.log(`DEBUG - Answer received from ${player.name}:`, answer);
            console.log(`DEBUG - Current answers: ${room.gameState.answers.size}/${room.players.length}`);
          
            if (room.gameState.answers.size === room.players.length) {
              // All players have submitted - show answers immediately
              console.log('DEBUG - All players submitted answers, showing results');
              broadcastToRoom(code, {
                type: 'show-answers',
                answers: Array.from(room.gameState.answers.entries()),
                originalQuestion: room.gameState.currentQuestion.normal,
                impostorQuestion: room.gameState.currentQuestion.impostor,
                impostor: room.gameState.impostor,
                round: room.gameState.round,
                totalRounds: room.settings.rounds
              });
            } else if (!message.forced) {
              // Normal submission, still waiting for others
              console.log(`DEBUG - Waiting for other players... (${room.gameState.answers.size}/${room.players.length})`);
              broadcastToRoom(code, {
                type: 'answer-status',
                submitted: room.gameState.answers.size,
                total: room.players.length
              });
            }
            break;
          }

          case 'submit-vote': {
            const { code, target } = message;
            const room = rooms[code];
            if (!room || !room.gameState.started) {
              ws.send(JSON.stringify({ type: 'error', message: 'Game not in progress.' }));
              break;
            }

            // Identify the player securely by their socket
            const player = room.players.find(p => p.socket === ws);
            if (!player || !player.name) {
              ws.send(JSON.stringify({ type: 'error', message: 'You are not in this room.' }));
              break;
            }

            // Validate the vote target is a real player
            const targetExists = room.players.some(p => p.name === target);
            if (!targetExists) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid vote target.' }));
              break;
            }

            // Prevent double voting
            if (room.gameState.votes.has(player.name)) {
              ws.send(JSON.stringify({ type: 'error', message: 'You already voted.' }));
              break;
            }


            // Initialize votes map if not exists
            if (!room.gameState.votes) {
              room.gameState.votes = new Map();
            }
          
            // Record the vote
            room.gameState.votes.set(player.name, message.target);
            console.log(`DEBUG - Vote received from ${player.name} for ${message.target}`);
            console.log(`DEBUG - Current votes: ${room.gameState.votes.size}/${room.players.length}`);
          
            // Broadcast vote update to all players
            broadcastToRoom(code, {
              type: 'vote-update',
              voter: player.name,
              target: message.target,
              total: room.gameState.votes.size,
              required: room.players.length
            });
          
            // Check if all votes are in
            if (room.gameState.votes.size >= room.players.length) {
              console.log('Check if all votes are in');
              handleVoteResults(code);
            }
            break;
          }

          case 'discussion-time-up': {
            const room = rooms[code];
            if (!room || !room.gameState.started || room.gameState.votesTallied) {
              break;
            }
          
            // Process votes if any exist
            console.log('Time is up, processing votes...');
            handleVoteResults(code);
            break;
          }

          case 'start-next-round': {
            const room = rooms[code];
            if (!room) {
                ws.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
                break;
            }
        
            // Check if max rounds reached
            if (room.gameState.round >= room.settings.rounds) {
                // Reset round to -1 to allow new joins
                room.gameState.round = -1;
                room.gameState.started = false;
                
                room.players.forEach(player => {
                    player.socket.send(JSON.stringify({
                        type: 'game-over',
                        message: 'Game Over! All rounds completed.',
                        totalRounds: room.settings.rounds
                    }));
                });
                break;
            }
        
            // Reset state for next round
            room.gameState = {
              ...room.gameState,
              answers: new Map(),
              votes: new Map(),
              votesTallied: false,
              round: room.gameState.round + 1
            };
          
            // Select new impostor and question
            const playerIndex = Math.floor(Math.random() * room.players.length);
            const selectedQuestion = selectQuestionPair();
            
            room.gameState.impostor = room.players[playerIndex].name;
            room.gameState.currentQuestion = selectedQuestion;
          
            // Send new roles and questions to all players
            room.players.forEach(player => {
              const isImpostor = player.name === room.gameState.impostor;
              const question = isImpostor ? selectedQuestion.impostor : selectedQuestion.normal;
              
              player.socket.send(JSON.stringify({
                type: 'game-role',
                isImpostor,
                question,
                round: room.gameState.round,
                totalRounds: room.settings.rounds
              }));
            });
          
            break;
          }
          
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
      }
    } catch (err) {
      console.error('Failed to handle message:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[DISCONNECT] Socket closed: ${ws.id}`);
    removePlayer(ws);
  });
  
});

function handleVoteResults(code) {
  const room = rooms[code];
  if (!room || room.gameState.votesTallied) return; // Skip if already tallied

  // Initialize votes map if it doesn't exist
  if (!room.gameState.votes) {
    room.gameState.votes = new Map();
  }

  const votes = room.gameState.votes;
  const voteCounts = new Map();
  
  // Count all votes, even if zero
  room.players.forEach(player => {
    voteCounts.set(player.name, 0);
  });
  
  // Only count votes if any exist
  if (votes.size > 0) {
    for (const target of votes.values()) {
      voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
    }
  }

  let maxVotes = 0;
  let votedPlayer = null;
  let isDraw = true; // Start with draw assumption (will be true if no votes)

  for (const [player, count] of voteCounts) {
    if (count > maxVotes) {
      maxVotes = count;
      votedPlayer = player;
      isDraw = false;
    } else if (count === maxVotes && count > 0) {
      isDraw = true;
    }
  }

  // Mark votes as tallied
  room.gameState.votesTallied = true;

  // Broadcast results
  broadcastToRoom(code, {
    type: 'vote-results',
    isDraw,
    votedPlayer,
    wasImpostor: votedPlayer === room.gameState.impostor,
    impostor: room.gameState.impostor,
    originalQuestion: room.gameState.currentQuestion.normal,
    impostorQuestion: room.gameState.currentQuestion.impostor,
    votes: Array.from(votes)
  });

  // Reset votes for next round
  //room.gameState.votes = new Map();
  //room.gameState.votesTallied = false; // Reset for next round
}

// Start the server
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});