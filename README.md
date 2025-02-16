# Rock Paper Scissors Multiplayer Game

A real-time multiplayer Rock Paper Scissors game built with Next.js, Socket.IO, and TypeScript.

## Features

- Real-time multiplayer gameplay
- Player registration with persistent names
- Game lobby system
- Quick rematch functionality
- Beautiful UI with animations
- Toast notifications for game events
- Responsive design

## Tech Stack

- **Frontend:**
  - Next.js 13+
  - React
  - TypeScript
  - Tailwind CSS
  - Lucide Icons
  - Socket.IO Client

- **Backend:**
  - Node.js
  - Express
  - Socket.IO
  - TypeScript

## Getting Started

1. Clone the repository:
```bash
git clone [your-repo-url]
cd [repo-name]
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
# Start the backend server
npm run server

# In a new terminal, start the frontend
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Play

1. Enter your name to join the game
2. Create a new game or join an existing one
3. Make your move (Rock, Paper, or Scissors)
4. Wait for your opponent's move
5. See the result and play again!

## Environment Variables

Create a `.env` file in the root directory:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
