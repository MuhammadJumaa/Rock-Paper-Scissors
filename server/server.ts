const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
import { Socket } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const PORT = process.env.PORT || 3001;

// Game state
interface Game {
  id: string;
  players: string[];
  moves: Record<string, string>;
  hostName: string;
}

interface Player {
  id: string;
  name: string;
}

const games: Record<string, Game> = {};
const players: Record<string, string> = {};
const playerSockets: Map<string, string> = new Map();

io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (name: string) => {
    players[socket.id] = name;
    playerSockets.set(name, socket.id);
    console.log(`Player ${name} registered`);
    
    // Send list of open games to the newly registered player
    const openGames = Object.entries(games)
      .filter(([_, game]) => game.players.length < 2)
      .map(([id, game]) => ({
        id,
        hostName: game.hostName
      }));
    socket.emit("openGames", openGames);
  });

  socket.on("createGame", () => {
    const gameId = Math.random().toString(36).substring(7);
    const playerName = players[socket.id];
    
    if (!playerName) {
      socket.emit("error", "You must register before creating a game");
      return;
    }

    games[gameId] = {
      id: gameId,
      players: [socket.id],
      moves: {},
      hostName: playerName
    };

    console.log(`Game created by ${playerName}:`, gameId);
    
    // Notify all clients about the new game
    io.emit("gameCreated", {
      id: gameId,
      hostName: playerName
    });

    socket.emit("waiting");
  });

  socket.on("joinGame", (gameId: string) => {
    const game = games[gameId];
    const playerName = players[socket.id];
    
    if (!game) {
      socket.emit("error", "Game not found");
      return;
    }

    if (!playerName) {
      socket.emit("error", "You must register before joining a game");
      return;
    }

    if (game.players.length >= 2) {
      socket.emit("error", "Game is full");
      return;
    }

    game.players.push(socket.id);
    
    const opponentId = game.players[0];
    const opponentName = players[opponentId];

    // Notify both players that the game is starting
    io.to(socket.id).emit("gameStart", {
      gameId,
      opponentId,
      opponentName
    });

    io.to(opponentId).emit("gameStart", {
      gameId,
      opponentId: socket.id,
      opponentName: playerName
    });

    // Remove the game from the open games list
    io.emit("gameClosed", gameId);
  });

  socket.on("makeMove", ({ gameId, move }: { gameId: string, move: string }) => {
    const game = games[gameId];
    if (!game) return;

    game.moves[socket.id] = move;

    // Notify opponent that a move was made
    const opponentId = game.players.find(id => id !== socket.id);
    if (opponentId) {
      io.to(opponentId).emit("opponentMoved");
    }

    // If both players have moved, calculate the result
    if (Object.keys(game.moves).length === 2) {
      const [player1Id, player2Id] = game.players;
      const player1Move = game.moves[player1Id];
      const player2Move = game.moves[player2Id];

      const getResult = (move1: string, move2: string) => {
        if (move1 === move2) return "tie";
        if (
          (move1 === "rock" && move2 === "scissors") ||
          (move1 === "paper" && move2 === "rock") ||
          (move1 === "scissors" && move2 === "paper")
        ) {
          return "win";
        }
        return "lose";
      };

      // Send results to both players
      io.to(player1Id).emit("gameResult", {
        yourMove: player1Move,
        opponentMove: player2Move,
        result: getResult(player1Move, player2Move),
        opponentName: players[player2Id],
        canRematch: true
      });

      io.to(player2Id).emit("gameResult", {
        yourMove: player2Move,
        opponentMove: player1Move,
        result: getResult(player2Move, player1Move),
        opponentName: players[player1Id],
        canRematch: true
      });

      // Reset moves for potential rematch
      game.moves = {};
    }
  });

  socket.on("requestRematch", (gameId: string) => {
    const game = games[gameId];
    if (!game) return;

    const opponentId = game.players.find(id => id !== socket.id);
    if (opponentId) {
      io.to(opponentId).emit("rematchRequested", players[socket.id]);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    
    // Remove player from any game they're in
    for (const gameId in games) {
      const game = games[gameId];
      if (game.players.includes(socket.id)) {
        const opponentId = game.players.find(id => id !== socket.id);
        if (opponentId) {
          io.to(opponentId).emit("opponentDisconnected");
        }
        delete games[gameId];
        io.emit("gameClosed", gameId);
      }
    }

    // Remove player from players list
    if (players[socket.id]) {
      playerSockets.delete(players[socket.id]);
      delete players[socket.id];
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
