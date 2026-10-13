# KioskArcade OS v2.0.0

A secure, scalable Electron-based WebGL arcade system for Windows 11 kiosk mode with analytics, multi-arcade management, venue operations, and a full **Competition Hub** for tournaments, player identity, venue sync, rewards, and seasons.

## New Features in v2.0.0

### Competition Hub (Smart Arcade Tournament & Challenge System)

Turns cabinets into a connected competition platform for operators and players.

**Phase 1 — Local competitions**
- Create and end high-score competitions from Admin
- Game adapters for `tetris`, `snake`, and `pong` with discrete scoring
- Guest score channel (game BrowserView → main process) with validation
- Local leaderboards persisted under `data/competitions.json` and `data/competition-scores.json`
- Escape exits a game, finalizes the score once, and returns to the menu

**Phase 2 — Player identity & achievements**
- Persistent profiles with QR code + optional PIN (4–8 digits)
- Personal bests and tournament history across visits
- Achievement progress bars and unlock toasts
- Admin review queue for flagged scores

**Phase 3 — Network / cross-cabinet**
- Venue sync via shared hub folder (`competitions.hubDir`, default `data/competition-hub`)
- Offline sync queue with max-score-wins conflict resolution
- Scheduled tournaments (daily / weekly / once) with auto-spawn and auto-end
- Live event timers, venue-wide rankings, and upcoming schedule on the player hub

**Phase 4 — Rewards & growth**
- Configurable rewards (badge, free play, coupon, prize) with staff approval for valuable items
- Auto-grant to top-N finishers when an event ends; auditable redemption history
- Seasons with point standings and seasonal ranks on player profiles
- Elimination brackets seeded from competition leaderboards
- Engagement analytics dashboard (participation, redemptions, achievements, sync runs)
- Stronger score validation using game progress (score vs lines/length, timing)

### Multi-Arcade Unit Management
- **Cluster Management**: Manage multiple arcade units as a single cluster
- **Load Balancing**: Intelligent game distribution across units (round-robin, least-loaded, geographic)
- **Health Monitoring**: Real-time status monitoring of all units
- **Auto Failover**: Automatic failover when units go offline
- **Game Distribution**: Synchronize games across multiple units

### Advanced Analytics Dashboard
- **Performance Monitoring**: Real-time CPU, memory, and disk usage tracking
- **User Behavior Analytics**: Track session duration, game preferences, and interaction patterns
- **Popular Games Analysis**: Identify most-played games and peak usage hours
- **Competition Engagement**: Participation, rewards, and event metrics from the Competition Hub
- **Data Export**: Export analytics data for external analysis

### Remote Monitoring Capabilities
- **Real-time Status**: Monitor arcade units remotely
- **Performance Alerts**: Get notified of performance issues
- **Remote Configuration**: Update settings across multiple units
- **Health Checks**: Automated health monitoring and reporting

### Mobile Admin App Support
- **QR Code Access**: Quick access via QR codes (also used for player profiles)
- **Push Notifications**: Real-time alerts and updates
- **Remote Control**: Full administrative control from mobile devices
- **Cross-platform Support**: iOS and Android compatibility

### Cloud-based Game Distribution
- **Automatic Updates**: Seamless game updates from cloud
- **Version Management**: Track and manage game versions across units
- **Bandwidth Optimization**: Efficient download and distribution
- **Offline Support**: Local caching for offline operation

### Smart Venue Operations
- **Venue Hours Gate**: Define weekly open/closed hours and automatically block game launches while closed
- **Closed Venue Screen**: Display a branded closed message for guests with a staff path to admin access
- **Admin Venue Override**: Authorized staff can force public open mode for special events
- **Boot Health Gate**: Optional startup checks for disk space, network reachability, games folder access, and WebGL
- **Inclusive Play Mode**: High contrast, larger touch targets, and reduced motion options

## Code Improvements

### Streamlined Architecture
- **Removed Duplicate Files**: Eliminated duplicate JavaScript files, keeping only TypeScript versions
- **Improved Type Safety**: Added comprehensive TypeScript interfaces and readonly properties
- **Better Error Handling**: Enhanced error handling throughout the application
- **Performance Optimizations**: Parallel initialization and improved data structures

### Service Improvements
- **GameManager**: Optimized game loading, caching, and competition-ready mock game HTML
- **AdminManager**: Enhanced configuration management
- **SecurityManager**: Improved security event handling
- **TokenManager**: Better token rotation and management (arcade/location IDs used for sync identity)
- **Logger**: Enhanced logging with better performance

### New Services
- **AnalyticsManager**: Comprehensive analytics and performance monitoring
- **MultiArcadeManager**: Multi-unit management and load balancing
- **ConfigManager**: Centralized configuration management
- **CompetitionManager** / **GameAdapterManager** / **ScoreValidationService**: Local competitions and scoring
- **PlayerProfileManager** / **AchievementManager**: Persistent players and achievements
- **CompetitionSyncService** / **TournamentScheduler** / **LeaderboardManager**: Venue sync and schedules
- **RewardManager** / **SeasonManager** / **BracketManager** / **CompetitionEngagementService**: Rewards, seasons, brackets, engagement

## Project Structure

```
KioskArcade-OS/
├── electron-app/
│   ├── config/
│   │   └── AppConfig.ts              # Centralized configuration (incl. competitions)
│   ├── services/
│   │   ├── AdminManager.ts
│   │   ├── AnalyticsManager.ts
│   │   ├── AchievementManager.ts
│   │   ├── BootHealthManager.ts
│   │   ├── BracketManager.ts
│   │   ├── CompetitionEngagementService.ts
│   │   ├── CompetitionManager.ts
│   │   ├── CompetitionSyncService.ts
│   │   ├── GameAdapterManager.ts
│   │   ├── GameManager.ts
│   │   ├── LeaderboardManager.ts
│   │   ├── MultiArcadeManager.ts
│   │   ├── PlayerProfileManager.ts
│   │   ├── RewardManager.ts
│   │   ├── ScoreValidationService.ts
│   │   ├── SeasonManager.ts
│   │   ├── SecurityManager.ts
│   │   ├── TokenManager.ts
│   │   ├── TournamentScheduler.ts
│   │   ├── VenueScheduleManager.ts
│   │   └── competition/
│   │       └── types.ts              # Shared competition contracts
│   ├── utils/
│   │   └── Logger.ts
│   ├── renderer/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── AchievementPanel.tsx
│   │       │   ├── BootHealthGate.tsx
│   │       │   ├── ClosedVenueScreen.tsx
│   │       │   ├── CompetitionAnalyticsPanel.tsx
│   │       │   ├── GameGrid.tsx
│   │       │   ├── LiveLeaderboard.tsx
│   │       │   ├── PlayerProfile.tsx
│   │       │   ├── RewardsPanel.tsx
│   │       │   ├── SeasonPanel.tsx
│   │       │   ├── TournamentAdmin.tsx
│   │       │   ├── TournamentBrowser.tsx
│   │       │   ├── VenueLeaderboard.tsx
│   │       │   └── VenueOverrideControls.tsx
│   │       └── App.tsx
│   ├── game-preload.ts               # Minimal guest preload for score reporting
│   ├── main.ts
│   └── preload.ts
├── data/                             # competitions, scores, profiles, hub, rewards, seasons…
├── games/                            # Installed game packages
├── logs/
├── __tests__/competition/            # Competition Hub unit tests
└── scripts/
```

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Windows 11 (for kiosk mode)

### Setup
```bash
# Clone the repository
git clone https://github.com/njahromi/KioskArcade-OS.git
cd kioskarcade-os

# Install dependencies
npm install

# Install renderer dependencies
cd electron-app/renderer
npm install
cd ../..

# Build the application
npm run build

# Start in development mode
npm run dev
```

## Configuration

### Competition Hub
```json
{
  "competitions": {
    "enabled": true,
    "syncEnabled": false,
    "syncIntervalMs": 60000,
    "hubDir": "data/competition-hub"
  }
}
```

- Set `syncEnabled` to `true` (or use Admin → Enable sync) to exchange results across cabinets.
- Point multiple units at the same `hubDir` (local path or network share) for venue-wide rankings.
- Competition data also lives in `data/competitions.json`, `data/competition-scores.json`, `data/player-profiles.json`, `data/competition-rewards.json`, `data/competition-seasons.json`, and `data/competition-brackets.json`.

### Multi-Arcade Setup
```json
{
  "arcade": {
    "type": "multi",
    "maxConcurrentGames": 4,
    "autoRestart": true
  },
  "network": {
    "cloudSync": true,
    "analyticsEnabled": true,
    "remoteMonitoring": true
  }
}
```

### Analytics Configuration
```json
{
  "analytics": {
    "enabled": true,
    "endpoint": "https://analytics.kioskarcade.com",
    "batchSize": 100,
    "flushInterval": 60,
    "trackUserBehavior": true,
    "performanceMonitoring": true
  }
}
```

### Venue Schedule Configuration
```json
{
  "venue": {
    "enabled": true,
    "weeklyHours": [
      { "start": "10:00", "end": "22:00" },
      { "start": "10:00", "end": "22:00" },
      { "start": "10:00", "end": "22:00" },
      { "start": "10:00", "end": "22:00" },
      { "start": "10:00", "end": "22:00" },
      { "start": "10:00", "end": "23:00" },
      { "start": "10:00", "end": "23:00" }
    ],
    "closedTitle": "Sorry, we are closed",
    "closedSubtitle": "Please visit during posted hours. Thank you!"
  }
}
```

### Boot Health Check Configuration
```json
{
  "healthCheck": {
    "enabled": true,
    "minFreeDiskMb": 512,
    "networkCheckUrl": "https://analytics.kioskarcade.com",
    "pingTimeoutMs": 8000,
    "blockPublicUntilPass": true
  }
}
```

### Inclusive Play Accessibility Configuration
```json
{
  "accessibility": {
    "highContrast": true,
    "largeTouchTargets": true,
    "reduceMotion": true
  }
}
```

## Using the Competition Hub

### Operators (Admin)
1. Sign in via **Admin**.
2. **Start competition** for `tetris`, `snake`, or `pong`.
3. Optionally start a **season**, enable **venue sync**, or add a **schedule**.
4. End events to auto-grant rewards and (if enabled) build an elimination bracket.
5. Review flagged scores and pending reward redemptions; check **Engagement analytics**.

### Players
1. Open **Players & standings** on the Games screen.
2. Create a profile (optional PIN) or sign in with QR text.
3. Play while a competition is active; Esc exits and submits the final score.
4. View live / venue leaderboards, achievements, rewards, and season standings.

### Quick test
```bash
# Unit tests for Competition Hub
npx jest --testPathPattern=competition
```

## Development

### Available Scripts
```bash
# Development
npm run dev                   # Start development mode
npm run dev:electron          # Start Electron only
npm run dev:renderer          # Start renderer only

# Building
npm run build                 # Build for production
npm run build:renderer        # Build renderer only
npm run build:electron        # Build Electron only

# Testing
npm run test                 # Run tests
npm run test:e2e             # Run end-to-end tests

# Utilities
npm run mock:pubsub          # Start mock Pub/Sub server
npm run mock:pos             # Start mock POS server
npm run setup:kiosk          # Setup Windows kiosk mode
npm run token:rotate         # Rotate security tokens
```

### Code Quality
- **TypeScript**: Full TypeScript support with strict type checking
- **ESLint**: Code linting and formatting
- **Prettier**: Consistent code formatting
- **Jest**: Unit and integration testing (including Competition Hub)

## Security Features

- **Lockdown Mode**: Prevent unauthorized access
- **Session Management**: Secure admin sessions with timeouts
- **Token Rotation**: Automatic security token rotation
- **Audit Logging**: Comprehensive security event logging
- **Encryption**: Data encryption for sensitive information
- **Narrow competition IPC**: Score ingestion only from the game guest preload; admin mutations password-gated
- **Player PIN hashing**: Profile PINs stored as hashes; never exposed to the renderer

## Analytics Features

- **Real-time Monitoring**: Live performance metrics
- **User Analytics**: Session tracking and behavior analysis
- **Game Analytics**: Popular games and usage patterns
- **Competition Engagement**: Events, rewards, achievements, and sync activity
- **System Health**: Performance and health monitoring
- **Data Export**: Export analytics for external analysis

## Multi-Arcade Features

- **Load Balancing**: Intelligent game distribution
- **Health Monitoring**: Real-time unit status
- **Auto Failover**: Automatic recovery from failures
- **Game Synchronization**: Cross-unit game management
- **Competition Sync**: Shared hub folder for cross-cabinet scores and events

## Mobile Admin Features

- **QR Code Access**: Quick mobile access
- **Push Notifications**: Real-time alerts
- **Remote Control**: Full administrative control
- **Cross-platform**: iOS and Android support

## Deployment

### Production Build
```bash
# Build for production
npm run build:binary

# Create installer
npm run dist
```

### Kiosk Mode Setup
```bash
# Setup Windows kiosk mode
npm run setup:kiosk
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: See docs/ folder
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions

## Changelog

### v2.0.0 (Current)
- Added **Competition Hub** (local competitions, player identity, venue sync, rewards, seasons, brackets)
- Added multi-arcade unit management
- Added advanced analytics dashboard and competition engagement metrics
- Added remote monitoring capabilities
- Added mobile admin app support
- Added cloud-based game distribution
- Added venue schedule gating with admin override controls
- Added optional boot health gate (disk/network/games/WebGL)
- Added inclusive play accessibility options
- Streamlined codebase and removed duplicates
- Improved TypeScript type safety
- Performance optimizations
- Enhanced security features (guest score channel, PIN hashing, admin-gated competition IPC)

### v1.0.0
- Initial release with basic arcade functionality
- Single unit management
- Basic game loading and security
