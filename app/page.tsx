"use client"

import { useState, useEffect } from "react"
import io, { type Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Swords, Users, Trophy, Loader2, GamepadIcon, RotateCcw } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

const ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

type Move = "rock" | "paper" | "scissors"
type GameResult = "win" | "lose" | "tie"

interface Game {
  id: string
  hostName: string
}

interface GameState {
  status: "unregistered" | "lobby" | "waiting" | "playing" | "result"
  gameId: string | null
  opponentId: string | null
  yourMove: Move | null
  opponentMove: Move | null
  result: GameResult | null
  opponentName: string | null
  rematchRequested: boolean
  rematchAvailable: boolean
  canRematch: boolean
}

const moveIcons: Record<Move, JSX.Element> = {
  rock: <span className="text-4xl">🪨</span>,
  paper: <span className="text-4xl">📄</span>,
  scissors: <span className="text-4xl">✂️</span>,
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [playerName, setPlayerName] = useState("")
  const [availableGames, setAvailableGames] = useState<Game[]>([])
  const [gameState, setGameState] = useState<GameState>({
    status: "unregistered",
    gameId: null,
    opponentId: null,
    yourMove: null,
    opponentMove: null,
    result: null,
    opponentName: null,
    rematchRequested: false,
    rematchAvailable: false,
    canRematch: false
  })

  // Load player name from localStorage on initial load
  useEffect(() => {
    const savedName = localStorage.getItem("playerName")
    if (savedName) {
      setPlayerName(savedName)
      setGameState(prev => ({ ...prev, status: "lobby" }))
    }
  }, [])

  useEffect(() => {
    const newSocket = io(ENDPOINT, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    })

    newSocket.on("connect", () => {
      console.log("Connected to server")
      setSocket(newSocket)
      
      // Register with saved name on reconnection
      const savedName = localStorage.getItem("playerName")
      if (savedName) {
        console.log("Auto-registering with saved name:", savedName)
        newSocket.emit("register", savedName)
      }
    })

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error)
      toast({
        title: "Connection Error",
        description: "Failed to connect to the game server. Please try again.",
        variant: "destructive"
      })
    })

    newSocket.on("error", (message: string) => {
      console.error("Server error:", message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
    })

    newSocket.on("openGames", (games: Game[]) => {
      console.log("Received open games:", games)
      setAvailableGames(games)
      setGameState(prev => ({ ...prev, status: "lobby" }))
    })

    newSocket.on("gameCreated", (game: Game) => {
      console.log("New game created:", game)
      setAvailableGames(prev => [...prev, game])
    })

    newSocket.on("gameClosed", (gameId: string) => {
      console.log("Game closed:", gameId)
      setAvailableGames(prev => prev.filter(game => game.id !== gameId))
    })

    newSocket.on("waiting", () => {
      console.log("Waiting for opponent")
      setGameState(prev => ({ ...prev, status: "waiting" }))
    })

    newSocket.on("gameStart", ({ gameId, opponentId, opponentName }) => {
      console.log("Game started:", { gameId, opponentId, opponentName })
      setGameState(prev => ({ 
        ...prev, 
        status: "playing", 
        gameId, 
        opponentId, 
        opponentName,
        yourMove: null,
        opponentMove: null,
        result: null,
        rematchRequested: false,
        rematchAvailable: false
      }))
    })

    newSocket.on("opponentMoved", () => {
      console.log("Opponent made a move")
      toast({
        title: "Opponent moved",
        description: "Your opponent has made their choice!"
      })
    })

    newSocket.on("gameResult", ({ yourMove, opponentMove, result, opponentName, canRematch }) => {
      console.log("Game result:", { yourMove, opponentMove, result, opponentName, canRematch })
      setGameState(prev => ({
        ...prev,
        status: "result",
        yourMove,
        opponentMove,
        result,
        opponentName,
        canRematch
      }))
    })

    newSocket.on("rematchRequested", (opponentName: string) => {
      console.log("Rematch requested by:", opponentName)
      setGameState(prev => ({ ...prev, rematchAvailable: true }))
      toast({
        title: "Rematch Request",
        description: `${opponentName} wants to play again!`
      })
    })

    newSocket.on("gameInvite", ({ gameId, hostName }) => {
      console.log("Game invite received from:", hostName)
      toast({
        title: "Game Invitation",
        description: `${hostName} wants to play another game with you!`,
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              joinGame(gameId)
              toast({
                title: "Joined Game",
                description: `You joined ${hostName}'s game!`
              })
            }}
          >
            Accept
          </Button>
        )
      })
    })

    newSocket.on("opponentDisconnected", () => {
      console.log("Opponent disconnected")
      setGameState(prev => ({ 
        ...prev, 
        status: "lobby",
        canRematch: false,
        rematchAvailable: false,
        rematchRequested: false
      }))
      toast({
        title: "Opponent disconnected",
        description: "Your opponent left the game.",
        variant: "destructive"
      })
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const registerPlayer = () => {
    if (socket && playerName.trim()) {
      const name = playerName.trim()
      console.log("Registering player:", name)
      localStorage.setItem("playerName", name)
      socket.emit("register", name)
    }
  }

  const createGame = () => {
    if (socket) {
      console.log("Creating new game")
      socket.emit("createGame")
    }
  }

  const joinGame = (gameId: string) => {
    if (socket) {
      console.log("Joining game:", gameId)
      socket.emit("joinGame", gameId)
    }
  }

  const makeMove = (move: Move) => {
    if (socket && gameState.status === "playing" && gameState.gameId) {
      console.log("Making move:", move)
      socket.emit("makeMove", { gameId: gameState.gameId, move })
      setGameState(prev => ({ ...prev, yourMove: move }))
    }
  }

  const requestRematch = () => {
    if (socket && gameState.gameId) {
      console.log("Requesting rematch")
      socket.emit("requestRematch", gameState.gameId)
      setGameState(prev => ({ ...prev, rematchRequested: true }))
      toast({
        title: "Rematch Requested",
        description: "Waiting for opponent to accept..."
      })
    }
  }

  const getResultColor = (result: GameResult | null) => {
    if (result === "win") return "text-green-500"
    if (result === "lose") return "text-red-500"
    if (result === "tie") return "text-yellow-500"
    return "text-gray-500"
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Rock Paper Scissors</h1>
          <p className="text-muted-foreground">
            {gameState.status === "unregistered" && "Enter your name to play"}
            {gameState.status === "lobby" && "Choose a game to join or create your own"}
            {gameState.status === "waiting" && "Waiting for an opponent..."}
            {gameState.status === "playing" && `Playing against ${gameState.opponentName}`}
            {gameState.status === "result" && "Game finished!"}
          </p>
        </div>

        {gameState.status === "unregistered" && (
          <div className="space-y-4">
            <Input
              placeholder="Enter your name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && registerPlayer()}
            />
            <Button 
              size="lg" 
              className="w-full" 
              onClick={registerPlayer}
              disabled={!playerName.trim()}
            >
              Start Playing
            </Button>
          </div>
        )}

        {gameState.status === "lobby" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Available Games</h2>
              {availableGames.length === 0 ? (
                <p className="text-sm text-muted-foreground">No games available</p>
              ) : (
                <div className="space-y-2">
                  {availableGames.map(game => (
                    <Button
                      key={game.id}
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => joinGame(game.id)}
                    >
                      <span>Game by {game.hostName}</span>
                      <GamepadIcon className="w-4 h-4" />
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <Button size="lg" className="w-full" onClick={createGame}>
              Create New Game
            </Button>
          </div>
        )}

        {gameState.status === "waiting" && (
          <div className="flex flex-col items-center space-y-4">
            <Users className="w-12 h-12 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Waiting for players to join...</p>
          </div>
        )}

        {gameState.status === "playing" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {(["rock", "paper", "scissors"] as Move[]).map((move) => (
                <Button
                  key={move}
                  variant={gameState.yourMove === move ? "secondary" : "outline"}
                  className="h-24 aspect-square"
                  onClick={() => makeMove(move)}
                  disabled={gameState.yourMove !== null}
                >
                  {moveIcons[move]}
                </Button>
              ))}
            </div>
            {gameState.yourMove && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Your choice</p>
                <div className="text-4xl">{moveIcons[gameState.yourMove]}</div>
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm">Waiting for {gameState.opponentName}...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {gameState.status === "result" && (
          <div className="space-y-6 text-center">
            <div className="grid grid-cols-3 items-center gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">You</p>
                <div className="text-4xl">{gameState.yourMove && moveIcons[gameState.yourMove]}</div>
              </div>
              <div>
                <Swords className="w-8 h-8 mx-auto text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{gameState.opponentName}</p>
                <div className="text-4xl">{gameState.opponentMove && moveIcons[gameState.opponentMove]}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Trophy className={`w-12 h-12 mx-auto ${getResultColor(gameState.result)}`} />
              <p className={`text-2xl font-bold ${getResultColor(gameState.result)}`}>
                {gameState.result === "win" && "You Won!"}
                {gameState.result === "lose" && "You Lost"}
                {gameState.result === "tie" && "It's a Tie!"}
              </p>
            </div>

            <div className="space-y-2">
              {gameState.canRematch && !gameState.rematchRequested && (
                <Button 
                  size="lg" 
                  className="w-full" 
                  onClick={requestRematch}
                  disabled={gameState.rematchRequested}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Quick Rematch
                </Button>
              )}
              {gameState.rematchRequested && (
                <p className="text-sm text-muted-foreground">
                  Waiting for {gameState.opponentName} to accept rematch...
                </p>
              )}
            </div>
          </div>
        )}
      </Card>
    </main>
  )
}
