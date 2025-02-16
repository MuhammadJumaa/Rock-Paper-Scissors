import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"

// Add these type definitions at the top of the file
type Move = "rock" | "paper" | "scissors"
type GameResult = "win" | "lose" | "tie"

interface Player {
  id: string
  name: string
}

interface GameState {
  players: Player[]
  moves: { [playerId: string]: Move }
  isOpen: boolean
  rematchRequested: { [playerId: string]: boolean }
}

function determineWinner(move1: Move, move2: Move): GameResult {
  if (move1 === move2) return "tie"
  if (
    (move1 === "rock" && move2 === "scissors") ||
    (move1 === "paper" && move2 === "rock") ||
    (move1 === "scissors" && move2 === "paper")
  ) {
    return "win"
  }
  return "lose"
}

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

app.use(cors())

const PORT = process.env.PORT || 3001

// Store player names and their socket IDs
const players: { [key: string]: string } = {}
const playerSockets: { [name: string]: string } = {}

// Store open games
const openGames: { [key: string]: GameState } = {}

// Store active game sessions
const gameSessions: { [key: string]: GameState } = {}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id)

  // Handle player registration
  socket.on("register", (name: string) => {
    console.log("Player registered:", socket.id, name)
    players[socket.id] = name
    playerSockets[name] = socket.id
    
    // Send the list of open games to the newly registered player
    const availableGames = Object.entries(openGames).map(([id, game]) => ({
      id,
      hostName: game.players[0].name
    }))
    console.log("Sending available games:", availableGames)
    socket.emit("openGames", availableGames)
  })

  // Handle creating a new game
  socket.on("createGame", () => {
    if (!players[socket.id]) {
      socket.emit("error", "Please register first")
      return
    }

    const gameId = `game-${socket.id}`
    openGames[gameId] = {
      players: [{ id: socket.id, name: players[socket.id] }],
      moves: {},
      isOpen: true,
      rematchRequested: {}
    }

    console.log("Game created:", gameId, "by", players[socket.id])

    // Broadcast new game to all players
    io.emit("gameCreated", {
      id: gameId,
      hostName: players[socket.id]
    })

    socket.emit("waiting")
  })

  // Handle creating a game with a specific opponent
  socket.on("createGameWithOpponent", ({ gameId, opponentName }: { gameId: string, opponentName: string }) => {
    console.log("Creating game with specific opponent:", { 
      gameId, 
      opponentName, 
      hostId: socket.id, 
      hostName: players[socket.id] 
    })
    
    if (!players[socket.id]) {
      console.log("Error: Player not registered")
      socket.emit("error", "Please register first")
      return
    }

    // Find the opponent's socket ID by their name
    const opponentId = playerSockets[opponentName]
    if (!opponentId) {
      console.log("Error: Opponent not found:", opponentName)
      socket.emit("error", "Opponent not found or has left the game")
      return
    }

    console.log("Found opponent socket:", opponentId)

    // Create the game
    openGames[gameId] = {
      players: [{ id: socket.id, name: players[socket.id] }],
      moves: {},
      isOpen: true,
      rematchRequested: {}
    }

    console.log("Game created for specific opponent:", gameId)

    // Notify the opponent specifically
    io.to(opponentId).emit("gameInvite", {
      gameId,
      hostName: players[socket.id]
    })

    // Also broadcast to all players to keep the game list updated
    io.emit("gameCreated", {
      id: gameId,
      hostName: players[socket.id]
    })

    socket.emit("waiting")
  })

  // Handle creating a direct game with a specific opponent (no open game)
  socket.on("createDirectGame", ({ opponentName }: { opponentName: string }) => {
    console.log("Creating direct game with opponent:", { 
      opponentName, 
      hostId: socket.id, 
      hostName: players[socket.id] 
    })
    
    if (!players[socket.id]) {
      console.log("Error: Player not registered")
      socket.emit("error", "Please register first")
      return
    }

    // Find the opponent's socket ID by their name
    const opponentId = playerSockets[opponentName]
    if (!opponentId) {
      console.log("Error: Opponent not found:", opponentName)
      socket.emit("error", "Opponent not found or has left the game")
      return
    }

    console.log("Found opponent socket:", opponentId)

    const gameId = `direct-${socket.id}-${Date.now()}`
    
    // Create the game directly in active sessions
    gameSessions[gameId] = {
      players: [
        { id: socket.id, name: players[socket.id] },
        { id: opponentId, name: opponentName }
      ],
      moves: {},
      isOpen: false,
      rematchRequested: {}
    }

    console.log("Direct game created:", gameId)

    // Notify both players immediately
    io.to(socket.id).emit("gameStart", { 
      gameId, 
      opponentId, 
      opponentName 
    })
    io.to(opponentId).emit("gameStart", { 
      gameId, 
      opponentId: socket.id, 
      opponentName: players[socket.id] 
    })
  })

  // Handle joining a specific game
  socket.on("joinGame", (gameId: string) => {
    console.log("Player attempting to join game:", socket.id, gameId)
    
    if (!players[socket.id]) {
      socket.emit("error", "Please register first")
      return
    }

    const game = openGames[gameId]
    if (!game || !game.isOpen) {
      socket.emit("error", "Game not available")
      return
    }

    // Add second player and move to active sessions
    game.players.push({ id: socket.id, name: players[socket.id] })
    game.isOpen = false
    gameSessions[gameId] = game
    delete openGames[gameId]

    const [host, joiner] = game.players
    console.log("Game started:", gameId, "between", host.name, "and", joiner.name)

    // Notify both players
    io.to(host.id).emit("gameStart", { gameId, opponentId: joiner.id, opponentName: joiner.name })
    io.to(joiner.id).emit("gameStart", { gameId, opponentId: host.id, opponentName: host.name })

    // Broadcast game closed
    io.emit("gameClosed", gameId)
  })

  // Handle making a move
  socket.on("makeMove", ({ gameId, move }: { gameId: string; move: Move }) => {
    console.log("Player made move:", socket.id, gameId, move)
    
    const gameState = gameSessions[gameId]
    if (!gameState) {
      console.log("Game not found:", gameId)
      return
    }

    gameState.moves[socket.id] = move

    if (Object.keys(gameState.moves).length === 2) {
      const [player1, player2] = gameState.players
      const move1 = gameState.moves[player1.id]
      const move2 = gameState.moves[player2.id]

      const result1 = determineWinner(move1, move2)
      const result2 = determineWinner(move2, move1)

      console.log("Game ended:", gameId, "Result:", result1)

      io.to(player1.id).emit("gameResult", { 
        yourMove: move1, 
        opponentMove: move2, 
        result: result1,
        opponentName: player2.name,
        canRematch: true
      })
      io.to(player2.id).emit("gameResult", { 
        yourMove: move2, 
        opponentMove: move1, 
        result: result2,
        opponentName: player1.name,
        canRematch: true
      })

      // Reset game state but keep players for potential rematch
      gameState.moves = {}
      gameState.rematchRequested = {}
    } else {
      const opponent = gameState.players.find(p => p.id !== socket.id)
      if (opponent) {
        io.to(opponent.id).emit("opponentMoved")
      }
    }
  })

  // Handle rematch request
  socket.on("requestRematch", (gameId: string) => {
    console.log("Rematch requested by:", socket.id, "for game:", gameId)
    
    const gameState = gameSessions[gameId]
    if (!gameState) {
      socket.emit("error", "Game not found")
      return
    }

    gameState.rematchRequested[socket.id] = true
    const opponent = gameState.players.find(p => p.id !== socket.id)
    
    if (opponent && gameState.rematchRequested[opponent.id]) {
      // Both players want a rematch, start new game
      gameState.moves = {}
      gameState.rematchRequested = {}
      
      io.to(gameState.players[0].id).emit("gameStart", { 
        gameId, 
        opponentId: gameState.players[1].id, 
        opponentName: gameState.players[1].name 
      })
      io.to(gameState.players[1].id).emit("gameStart", { 
        gameId, 
        opponentId: gameState.players[0].id, 
        opponentName: gameState.players[0].name 
      })
    } else if (opponent) {
      // Notify opponent about rematch request
      io.to(opponent.id).emit("rematchRequested", players[socket.id])
    }
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
    
    // Remove from playerSockets mapping
    if (players[socket.id]) {
      delete playerSockets[players[socket.id]]
    }
    
    // Clean up open games
    for (const [gameId, game] of Object.entries(openGames)) {
      if (game.players.some(p => p.id === socket.id)) {
        delete openGames[gameId]
        io.emit("gameClosed", gameId)
      }
    }

    // Clean up active games and notify opponents
    for (const [gameId, game] of Object.entries(gameSessions)) {
      if (game.players.some(p => p.id !== socket.id)) {
        const opponent = game.players.find(p => p.id !== socket.id)
        if (opponent) {
          io.to(opponent.id).emit("opponentDisconnected")
        }
        delete gameSessions[gameId]
      }
    }

    // Clean up player data
    delete players[socket.id]
  })
})

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
