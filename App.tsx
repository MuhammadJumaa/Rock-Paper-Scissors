"use client"

import { useState, useEffect } from "react"
import io, { type Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"

const ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

type Move = "rock" | "paper" | "scissors"
type GameResult = "win" | "lose" | "tie"

interface GameState {
  status: "waiting" | "playing" | "result"
  gameId: string | null
  opponentId: string | null
  yourMove: Move | null
  opponentMove: Move | null
  result: GameResult | null
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [gameState, setGameState] = useState<GameState>({
    status: "waiting",
    gameId: null,
    opponentId: null,
    yourMove: null,
    opponentMove: null,
    result: null,
  })

  useEffect(() => {
    const newSocket = io(ENDPOINT)
    setSocket(newSocket)

    newSocket.on("waiting", () => {
      setGameState((prev) => ({ ...prev, status: "waiting" }))
    })

    newSocket.on("gameStart", ({ gameId, opponentId }) => {
      setGameState((prev) => ({ ...prev, status: "playing", gameId, opponentId }))
    })

    newSocket.on("opponentMoved", () => {
      console.log("Opponent has made a move")
    })

    newSocket.on("gameResult", ({ yourMove, opponentMove, result }) => {
      setGameState((prev) => ({
        ...prev,
        status: "result",
        yourMove,
        opponentMove,
        result,
      }))
    })

    newSocket.on("opponentDisconnected", () => {
      setGameState((prev) => ({ ...prev, status: "waiting" }))
      alert("Your opponent disconnected. Game over.")
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const joinQueue = () => {
    if (socket) {
      socket.emit("joinQueue")
    }
  }

  const makeMove = (move: Move) => {
    if (socket && gameState.status === "playing" && gameState.gameId) {
      socket.emit("makeMove", { gameId: gameState.gameId, move })
      setGameState((prev) => ({ ...prev, yourMove: move }))
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">Rock Paper Scissors</h1>
      {gameState.status === "waiting" && <Button onClick={joinQueue}>Join Game</Button>}
      {gameState.status === "playing" && (
        <div className="space-y-4">
          <p>Game in progress...</p>
          <div className="flex space-x-4">
            <Button onClick={() => makeMove("rock")} disabled={gameState.yourMove !== null}>
              Rock
            </Button>
            <Button onClick={() => makeMove("paper")} disabled={gameState.yourMove !== null}>
              Paper
            </Button>
            <Button onClick={() => makeMove("scissors")} disabled={gameState.yourMove !== null}>
              Scissors
            </Button>
          </div>
          {gameState.yourMove && <p>You chose: {gameState.yourMove}</p>}
          {gameState.opponentMove && <p>Opponent chose: {gameState.opponentMove}</p>}
        </div>
      )}
      {gameState.status === "result" && (
        <div className="space-y-4">
          <p>Game Result:</p>
          <p>You chose: {gameState.yourMove}</p>
          <p>Opponent chose: {gameState.opponentMove}</p>
          <p>Result: {gameState.result}</p>
          <Button onClick={joinQueue}>Play Again</Button>
        </div>
      )}
    </div>
  )
}

export default App

