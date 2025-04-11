
const ws = new WebSocket('ws://localhost:3000');

const avatarFilenames = [
    "Avatar1.png", "Avatar2.png", "Avatar3.png", "Avatar4.png",
    "Avatar5.png", "Avatar6.png", "Avatar7.png", "Avatar8.png"
  ];

  const avatars = [
    { file: "Avatar1.png", name: "Avatar1" },
    { file: "Avatar2.png", name: "Avatar2" },
    { file: "Avatar3.png", name: "Avatar3" },
    { file: "Avatar4.png", name: "Avatar4" },
    { file: "Avatar5.png", name: "Avatar5" },
    { file: "Avatar6.png", name: "Avatar6" },
    { file: "Avatar7.png", name: "Avatar7" },
    { file: "Avatar8.png", name: "Avatar8" },
  ];
  
  let selectedAvatar = null;
  
  // Create avatar buttons dynamically
  window.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('avatar-grid');
  
    avatars.forEach((avatar, index) => {
      const img = document.createElement('img');
      img.src = `/avatars/${avatar.file}`;
      img.alt = avatar.name;
      img.className = "w-20 h-auto rounded-lg border-2 border-transparent cursor-pointer transition-transform hover:scale-105 floaty";
  
      const delay = (Math.random() * 2).toFixed(2);
      img.style.animationDelay = `${delay}s`;
  
      img.addEventListener('click', () => {
        selectedAvatar = avatar.file;
  
        // Update UI
        document.querySelectorAll('#avatar-grid img').forEach(el => {
          el.classList.remove('border-lime-400');
          el.classList.add('border-transparent');
        });
  
        img.classList.remove('border-transparent');
        img.classList.add('border-lime-400');
  
        document.getElementById('selected-avatar').textContent = `Selected: ${avatar.name}`;
      });
  
      grid.appendChild(img);
    });
  });
  

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log("Received message:", message);

    if (message.type === 'player-joined' || message.type === 'room-created') {
        sessionStorage.setItem('roomCode', message.code || document.getElementById('joinCode').value);
        sessionStorage.setItem('playerName', document.getElementById('name').value);
        sessionStorage.setItem('playerAvatar', selectedAvatar);
        
        // Store leadership status explicitly if this is a room creation
        if (message.type === 'room-created') {
            sessionStorage.setItem('isLeader', 'true');
        }
        
        // Store player data for immediate access in lobby
        if (message.players) {
            sessionStorage.setItem('playerData', JSON.stringify(message.players));
        }
        
        window.location.href = '/lobby.html';
    }
    
    if (message.type === 'error') {
        alert(message.message);
    }
};

function createRoom() {
  const name = document.getElementById('name').value;
  if (!name || !selectedAvatar) return alert("Please enter a name and choose an avatar.");
  
  // Store that this player is creating a room (will be leader)
  sessionStorage.setItem("isLeader", "true");
  
  ws.send(JSON.stringify({ type: 'create-room', name, avatar: selectedAvatar }));
}
  
  function joinRoom() {
    const name = document.getElementById('name').value;
    const code = document.getElementById('joinCode').value.toUpperCase();
    if (!name || !code || !selectedAvatar) return alert("Fill everything!");
    ws.send(JSON.stringify({
      type: 'join-room',
      name,
      code,
      avatar: selectedAvatar
    }));
  }
  