# KioskArcade OS v2.0.0

A secure, scalable Electron-based WebGL arcade system for Windows 11 kiosk mode with advanced analytics, multi-arcade management, and cloud-based features.

## 🚀 New Features in v2.0.0

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
- **System Performance Metrics**: Monitor system health and performance trends
- **Data Export**: Export analytics data for external analysis

### Remote Monitoring Capabilities
- **Real-time Status**: Monitor arcade units remotely
- **Performance Alerts**: Get notified of performance issues
- **Remote Configuration**: Update settings across multiple units
- **Health Checks**: Automated health monitoring and reporting

### Mobile Admin App Support
- **QR Code Access**: Quick access via QR codes
- **Push Notifications**: Real-time alerts and updates
- **Remote Control**: Full administrative control from mobile devices
- **Cross-platform Support**: iOS and Android compatibility

### Cloud-based Game Distribution
- **Automatic Updates**: Seamless game updates from cloud
- **Version Management**: Track and manage game versions across units
- **Bandwidth Optimization**: Efficient download and distribution
- **Offline Support**: Local caching for offline operation

### Real-time Multiplayer Support
- **Cross-unit Play**: Players can compete across different arcade units
- **Leaderboards**: Global and local leaderboards
- **Matchmaking**: Intelligent player matching
- **Network Optimization**: Optimized for low-latency multiplayer

## 🧹 Code Improvements

### Streamlined Architecture
- **Removed Duplicate Files**: Eliminated duplicate JavaScript files, keeping only TypeScript versions
- **Improved Type Safety**: Added comprehensive TypeScript interfaces and readonly properties
- **Better Error Handling**: Enhanced error handling throughout the application
- **Performance Optimizations**: Parallel initialization and improved data structures

### Service Improvements
- **GameManager**: Optimized game loading and caching
- **AdminManager**: Enhanced configuration management
- **SecurityManager**: Improved security event handling
- **TokenManager**: Better token rotation and management
- **Logger**: Enhanced logging with better performance

### New Services
- **AnalyticsManager**: Comprehensive analytics and performance monitoring
- **MultiArcadeManager**: Multi-unit management and load balancing
- **ConfigManager**: Centralized configuration management

## 📁 Project Structure

```
KioskArcade-OS/
├── electron-app/
│   ├── config/
│   │   └── AppConfig.ts          # Centralized configuration
│   ├── services/
│   │   ├── AdminManager.ts       # Admin interface management
│   │   ├── AnalyticsManager.ts   # Analytics and monitoring
│   │   ├── GameManager.ts        # Game management
│   │   ├── MultiArcadeManager.ts # Multi-unit management
│   │   ├── SecurityManager.ts    # Security and lockdown
│   │   └── TokenManager.ts       # Token management
│   ├── utils/
│   │   └── Logger.ts             # Enhanced logging
│   ├── renderer/
│   │   └── src/
│   │       ├── components/
│   │       │   └── GameGrid.tsx  # Optimized game grid
│   │       └── App.tsx           # Main application
│   ├── main.ts                   # Main process
│   └── preload.ts                # Preload script
├── data/                         # Application data
├── games/                        # Game files
├── logs/                         # Log files
└── scripts/                      # Utility scripts
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Windows 11 (for kiosk mode)

### Setup
```bash
# Clone the repository
git clone https://github.com/your-org/kioskarcade-os.git
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

## ⚙️ Configuration

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

## 🔧 Development

### Available Scripts
```bash
# Development
npm run dev                    # Start development mode
npm run dev:electron          # Start Electron only
npm run dev:renderer          # Start renderer only

# Building
npm run build                 # Build for production
npm run build:renderer        # Build renderer only
npm run build:electron        # Build Electron only

# Testing
npm run test                  # Run tests
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
- **Jest**: Unit and integration testing

## 🔒 Security Features

- **Lockdown Mode**: Prevent unauthorized access
- **Session Management**: Secure admin sessions with timeouts
- **Token Rotation**: Automatic security token rotation
- **Audit Logging**: Comprehensive security event logging
- **Encryption**: Data encryption for sensitive information

## 📊 Analytics Features

- **Real-time Monitoring**: Live performance metrics
- **User Analytics**: Session tracking and behavior analysis
- **Game Analytics**: Popular games and usage patterns
- **System Health**: Performance and health monitoring
- **Data Export**: Export analytics for external analysis

## 🌐 Multi-Arcade Features

- **Load Balancing**: Intelligent game distribution
- **Health Monitoring**: Real-time unit status
- **Auto Failover**: Automatic recovery from failures
- **Game Synchronization**: Cross-unit game management
- **Performance Optimization**: Resource-aware distribution

## 📱 Mobile Admin Features

- **QR Code Access**: Quick mobile access
- **Push Notifications**: Real-time alerts
- **Remote Control**: Full administrative control
- **Cross-platform**: iOS and Android support

## 🚀 Deployment

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: See docs/ folder
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
- **Email**: support@kioskarcade.com

## 🔄 Changelog

### v2.0.0 (Current)
- ✨ Added multi-arcade unit management
- ✨ Added advanced analytics dashboard
- ✨ Added remote monitoring capabilities
- ✨ Added mobile admin app support
- ✨ Added cloud-based game distribution
- ✨ Added real-time multiplayer support
- 🧹 Streamlined codebase and removed duplicates
- 🔧 Improved TypeScript type safety
- ⚡ Performance optimizations
- 🛡️ Enhanced security features

### v1.0.0
- Initial release with basic arcade functionality
- Single unit management
- Basic game loading and security 
