# OFFTOPIC

**OFFTOPIC** is a social deduction party game where players must blend in, lie, and detect the impostor among them — but with a twist: questions are deceptively similar, and only one person gets the odd one out.

---

## About the Game

In OFFTOPIC, players are secretly assigned roles: either **Innocents** or **Impostors**. Everyone is presented with a question to answer — except the impostor, who receives a different but similar question. After answers are given, players must discuss and vote to uncover who was OFFTOPIC.

No two games are alike, and the deceptive similarity of questions means even a good liar might slip up. Whether you're playing in person or over voice chat, it's a test of wit, creativity, and deception.

---

## Game Flow

### 1. **Lobby Setup**

* Players join a room with a unique code.
* The host sets the number of rounds and timers.

### 2. **Question Assignment**

* All players receive a question.
* One impostor receives a different, but subtly mismatched question.

*Example:*

* Innocents: "What's your favorit food?"
* Impostor: "What's a "good" food that you hate?"

### 3. **Answering Phase**

* Players write down their answer.
* A visible timer counts down.

### 4. **Discussion Phase**

* Everyone's answers are revealed.
* Players have time to discuss and figure out who might be off-topic.

### 5. **Voting Phase**

* Each player votes for who they suspect.
* The player with the most votes is eliminated.
* If the impostor is caught, innocents score. If not, the impostor wins the round.

### 6. **Next Rounds**

* Game continues for the set number of rounds.
* Roles rotate; questions change.

---

## Features

* **WebSocket-powered real-time multiplayer**
* Mobile and desktop compatibility
* Flexible room settings (rounds, timers,ect)
* Auto-leader assignment
* Secure room-based architecture

---

## Screenshots

### Lobby Creation

![Lobby Setup](https://github.com/IthamarBaron/OFFTOPIC/raw/main/screenshots/lobby.png)

### Role Assignment

![Role Assignment](https://github.com/IthamarBaron/OFFTOPIC/raw/main/screenshots/role.png)

### Question Reveal

![Question Reveal](https://github.com/IthamarBaron/OFFTOPIC/raw/main/screenshots/question.png)

### Answer Discussion

![Answer Discussion](https://github.com/IthamarBaron/OFFTOPIC/raw/main/screenshots/discussion.png)

### Voting Phase

![Voting Phase](https://github.com/IthamarBaron/OFFTOPIC/raw/main/screenshots/voting.png)

---

## Project Structure

```
OFFTOPIC/
├── public/
│   ├── index.html
│   ├── lobby.html
│   ├── game.html
│   └── assets/         # Contains images, avatars, background art
├── server.js           # Main WebSocket + HTTP server
├── rooms.js            # Room logic and game state handling
├── game.js             # Game mechanics and flow
├── lobby.js            # Lobby client-side logic
├── script.js           # Shared UI helpers
├── package.json        # Project metadata and dependencies
└── README.md
```

---

## How to Run Locally

1. Clone the repo:

```bash
git clone https://github.com/IthamarBaron/OFFTOPIC.git
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

4. Visit [http://localhost:3000](http://localhost:3000) to start playing.

---

## Deployment Notes

* Hosted on **Render** if you catch me on a good day you can visit https://offtopic-server.onrender.com/
* Server auto-sleeps on inactivity (Render free-tier feature)

---
