# Egg Prix 🐔

Original real-time multiplayer chicken-and-egg kart racing game. No accounts or installations for players. Supports 1–8 players per room, room codes, live state synchronization, four chickens with different special powers, five egg vehicles with different handling, three-lap oval races, mobile touch controls, and rematches.

## Run locally

1. Install Node.js 18 or newer.
2. In this directory run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in your browser.

## Publish a public link

Push this folder to a GitHub repository, then deploy it as a **Node.js web service** on a provider such as Render or Railway. Set the build command to `npm install` and start command to `npm start`. The server reads the provider's `PORT` environment variable automatically. Share the resulting HTTPS URL. Players can create a room and share the room code or invite link.

**Important:** Use a persistent Node.js web service with WebSocket support, not static-only hosting. Rooms currently live in the server's memory, so a restart clears rooms; multiple independent server instances will not share rooms. For production scaling, add shared storage / Socket.IO Redis adapter, authentication-free reconnect tokens, rate limiting, and monitoring.

## Game controls

Desktop: W / Up = accelerate, S / Down = brake, A/D or Left/Right = steer, Space = special.

Phone: on-screen steering, gas, brake, and special buttons.

Race clockwise for three laps. Leaving the track slows you down. Every chicken has a special ability with a cooldown.

## Original game concept

This is an independent prototype using original game names and browser-rendered shapes and emoji, not Mario Kart assets.
