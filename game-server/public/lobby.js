// public/lobby.js
const ws = new WebSocket('ws://localhost:3000');

// Grab saved room info
const roomCode = sessionStorage.getItem("roomCode") || "XXXX";
const playerName = sessionStorage.getItem("playerName") || "Unknown";
const playerAvatar = sessionStorage.getItem("playerAvatar");
let isLeader = false; // Track whether current player is the leader

// Game settings with defaults
let gameSettings = {
  rounds: 4,
  answeringTime: 30,
  discussionTime: 80
};

ws.onopen = () => {
    console.log("WebSocket connected in lobby");
    
    // Check for reconnection from game
    const roomState = sessionStorage.getItem('roomState');
    const wasLeader = sessionStorage.getItem('wasLeader');
    
    if (roomState) {
        const state = JSON.parse(roomState);
        
        ws.send(JSON.stringify({
            type: 'join-room',
            code: state.code,
            name: state.playerName,
            avatar: state.playerAvatar,
            isReconnect: true,
            wasLeader: wasLeader === 'true'
        }));
        
        // Clean up
        sessionStorage.removeItem('roomState');
        sessionStorage.removeItem('wasLeader');
    } else if (roomCode && roomCode !== "XXXX" && playerName) {
        // Regular join-room...
        ws.send(JSON.stringify({
            type: 'join-room',
            code: roomCode,
            name: playerName,
            avatar: playerAvatar,
            isReconnect: true
        }));
    }
};

// Update the handler for room state updates
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log("Lobby message received:", message);

    if (message.type === 'redirect-to-game') {
        console.log("Redirecting to game...");
        window.location.href = "/game.html";
    }

    if (message.type === 'leadership-status') {
        console.log(`Leadership status received: ${message.isLeader}`);
    }

    if (message.type === 'player-joined' || message.type === 'room-created') {
        // Reset leader status before updating
        isLeader = false;
        
        // Update players and check leader status from server response
        const players = message.players;
        const currentPlayer = players.find(p => p.name === playerName);
        if (currentPlayer) {
            isLeader = currentPlayer.isLeader;
            // Update session storage with current leader status
            sessionStorage.setItem("isLeader", isLeader);
        }
        
        renderPlayers(players);
        updateLeaderControls();
    }

    if (message.type === 'player-left') {
        renderPlayers(message.players);
        updateLeaderControls();
    }
    
    if (message.type === 'room-created') {
        isLeader = true;
        updateLeaderControls();
    }
    
    if (message.type === 'leader-changed') {
        // Check if current player is the new leader
        const currentPlayerIsNewLeader = message.players.find(p => 
            p.name === playerName && p.isLeader
        );
        
        if (currentPlayerIsNewLeader) {
            isLeader = true;
            showNotification("You are now the lobby leader!");
        }
        
        updateLeaderControls();
        renderPlayers(message.players);
    }
    
    if (message.type === 'settings-updated') {
        if (message.settings) {
            gameSettings = message.settings;
            updateSettingsUI();
            showNotification("Game settings updated!");
        }
    }
    
    if (message.type === 'error') {
        alert(message.message);
    }
};

function renderPlayers(players) {
    if (!players || !Array.isArray(players)) {
        console.error("Invalid players data:", players);
        return;
    }

    //debuging prints
    console.log("Players data received:", players);
    players.forEach(player => {
      console.log(`Player: ${player.name}, isLeader: ${player.isLeader}`);
    });


    const container = document.getElementById("player-list");
    const counter = document.getElementById("player-count");

    container.innerHTML = "";
    players.forEach(player => {
        const div = document.createElement("div");
        div.className = "flex flex-col items-center space-y-1";

        const imgContainer = document.createElement("div");
        imgContainer.className = "relative";
        
        const img = document.createElement("img");
        img.src = `/avatars/${player.avatar}`;
        img.alt = player.name;
        img.className = "w-24 h-auto rounded-full border-2 border-lime-400 floaty transition-transform";
        
        // Add golden outline for leader
        if (player.isLeader) {
            img.classList.remove('border-lime-400');
            img.classList.add('border-yellow-400', 'leader-outline');
        }
        
        // Add error handler for missing images
        img.onerror = () => {
            console.error(`Failed to load avatar: ${player.avatar}`);
            img.src = "/avatars/Avatar1.png"; // Fallback avatar
        };
        
        imgContainer.appendChild(img);
        
        // Add crown icon for leader
        if (player.isLeader) {
            const crown = document.createElement("div");
            crown.className = "absolute -top-3 -right-1 bg-yellow-400 p-1 rounded-full crown-icon";
            crown.innerHTML = '👑';
            crown.title = "Room Leader";
            imgContainer.appendChild(crown);
        }

        const nameTag = document.createElement("span");
        nameTag.className = "text-sm text-white font-medium";
        nameTag.textContent = player.name;
        
        // Add "You" indicator if this is the current player
        if (player.name === playerName) {
            const youIndicator = document.createElement("span");
            youIndicator.className = "ml-1 bg-gray-700 text-xs px-1 rounded";
            youIndicator.textContent = "(You)";
            nameTag.appendChild(youIndicator);
        }

        div.appendChild(imgContainer);
        div.appendChild(nameTag);
        container.appendChild(div);
    });

    // Update player counter
    if (counter) {
        counter.textContent = `Players in lobby: ${players.length}`;
    }
}

function updateLeaderControls() {
    const settingsPanel = document.getElementById("settings-panel");
    const startButton = document.getElementById("start-button");
    const saveButton = document.getElementById("save-settings");
    
    // Enable/disable settings inputs based on leader status
    const settingsInputs = document.querySelectorAll("#settings-panel select");
    
    if (isLeader) {
        // Enable settings panel for leader
        settingsPanel.classList.remove("opacity-50");
        settingsInputs.forEach(input => {
            input.disabled = false;
        });
        
        // Enable save settings button
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.classList.remove("opacity-50", "cursor-not-allowed");
            saveButton.classList.add("cursor-pointer");
            
            // Add click event listener to save button
            saveButton.onclick = saveSettings;
        }
        
        // Enable start button
        startButton.disabled = false;
        startButton.classList.remove("bg-gray-700", "opacity-50", "cursor-not-allowed");
        startButton.classList.add("bg-[#A8FF60]", "text-black", "hover:bg-[#B2FF70]");
        
        // Add click event listener
        startButton.onclick = startGame;
    } else {
        // Disable settings panel for non-leaders 
        settingsPanel.classList.add("opacity-50");
        settingsInputs.forEach(input => {
            input.disabled = true;
        });
        
        // Disable save settings button
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.classList.add("opacity-50", "cursor-not-allowed");
            saveButton.classList.remove("cursor-pointer");
            saveButton.onclick = null;
        }
        
        // Disable start button
        startButton.disabled = true;
        startButton.classList.remove("bg-[#A8FF60]", "text-black", "hover:bg-[#B2FF70]");
        startButton.classList.add("bg-gray-700", "opacity-50", "cursor-not-allowed");
        
        // Remove click event listener
        startButton.onclick = null;
    }
}

function saveSettings() {
    if (!isLeader) return;
    
    // Get values from UI
    const rounds = parseInt(document.getElementById("rounds").value);
    const answeringTime = parseInt(document.getElementById("answer-time").value);
    const discussionTime = parseInt(document.getElementById("discussion-time").value);
    
    // Update local settings
    gameSettings = {
        rounds,
        answeringTime,
        discussionTime
    };
    
    // Save to session storage
    sessionStorage.setItem("gameSettings", JSON.stringify(gameSettings));
    
    // Send to server
    ws.send(JSON.stringify({
        type: 'update-settings',
        code: roomCode,
        settings: gameSettings
    }));
    
    showNotification("Settings saved!");
}

function updateSettingsUI() {
    // Update UI to reflect current settings
    document.getElementById("rounds").value = gameSettings.rounds;
    document.getElementById("answer-time").value = gameSettings.answeringTime;
    document.getElementById("discussion-time").value = gameSettings.discussionTime;
}

function startGame() {
    sessionStorage.setItem("gameSettings", JSON.stringify(gameSettings)); 
    ws.send(JSON.stringify({
      type: 'start-game',
      code: roomCode,
      settings: gameSettings
    }));
  }

function showNotification(message) {
    // Create a notification element
    const notification = document.createElement("div");
    notification.className = "fixed top-4 right-4 bg-[#A8FF60] text-black px-4 py-2 rounded-lg shadow-lg z-50 opacity-0 transition-opacity duration-300";
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
        notification.classList.remove("opacity-0");
    }, 100);
    
    // Fade out and remove
    setTimeout(() => {
        notification.classList.add("opacity-0");
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Display room code when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById("room-code").textContent = roomCode;
    
    // Load saved settings if available
    const savedSettings = sessionStorage.getItem("gameSettings");
    if (savedSettings) {
        try {
            gameSettings = JSON.parse(savedSettings);
            updateSettingsUI();
        } catch (e) {
            console.error("Failed to parse saved settings", e);
        }
    }
    
    // Initialize UI state
    updateLeaderControls();
});