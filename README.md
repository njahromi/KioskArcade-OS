# 🎮 KioskArcade OS

A secure Electron-based WebGL arcade system designed for Windows 11 kiosk mode deployment.

## 🚀 Features

- **Windows 11 Kiosk Mode Integration** - Automated setup script for secure arcade deployment
- **Electron Admin Interface** - React/TypeScript admin panel with password protection
- **WebGL Game Delivery** - Local game caching and fullscreen WebGL execution
- **GCP Pub/Sub Integration** - Secure token management and cloud communication
- **POS Integration Simulator** - Mock POS onboarding and activation system
- **Automated Updates** - Delta-based game update system
- **App Lockdown** - Complete system isolation and security hardening

## 📁 Project Structure

```
kioskarcade/
├── electron-app/          # Main Electron application
│   ├── main.ts           # Electron main process
│   ├── preload.ts        # Secure preload scripts
│   ├── renderer/         # React admin interface
│   └── games/            # Local WebGL game storage
├── scripts/              # Setup and utility scripts
├── pubsub-mock/          # GCP Pub/Sub simulator
├── pos-simulator/        # Mock POS onboarding server
├── manifest.json         # Game version metadata
└── package.json          # Project dependencies
```

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+ 
- Windows 11 (for kiosk mode features)
- PowerShell (for setup scripts)

### Installation

1. **Clone and Install Dependencies**
   ```bash
   git clone https://github.com/njahromi/KioskArcade-OS
   cd KioskArcade-OS
   npm install
   ```

2. **Setup Kiosk Mode** (Windows 11)
   ```powershell
   .\scripts\setup-kiosk.ps1
   ```

3. **Start Development**
   ```bash
   npm run dev
   ```

4. **Build Production**
   ```bash
   npm run build
   ```

## 🔧 Configuration

### Arcade Settings
- Location ID and name configuration
- Network connectivity testing
- Manual game synchronization
- Local log viewing

### Security Features
- Context isolation and sandboxing
- Disabled OS shortcuts (Ctrl+Alt+Del, Alt+Tab)
- App lockdown preventing escape
- Secure token rotation

## 🎮 Game Management

### WebGL Game Delivery
- Remote manifest loading from GCP bucket
- Local game caching system
- Fullscreen iframe execution
- Delta-based update system

### Update System
- Automated version checking
- Incremental download support
- Local metadata storage
- Rollback capabilities

## 🔐 Security Architecture

### Token Management
- Unique arcade unit identification
- GCP Pub/Sub integration
- Secure local storage
- Periodic token rotation

### App Lockdown
- Electron security best practices
- System-level shortcut blocking
- Fullscreen enforcement
- Escape prevention

## 🧪 Development

### Testing
```bash
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:admin    # Admin interface tests
```

### Mock Services
```bash
npm run mock:pubsub   # Start Pub/Sub simulator
npm run mock:pos      # Start POS simulator
```

## 📦 Deployment

### Single Binary Build
```bash
npm run build:binary  # Create standalone executable
```

### Kiosk Mode Deployment
1. Run setup script on target Windows 11 machine
2. Install built application
3. Configure auto-startup
4. Test security lockdown

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Roadmap

- [ ] Multi-arcade unit management
- [ ] Advanced analytics dashboard
- [ ] Remote monitoring capabilities
- [ ] Mobile admin app
- [ ] Cloud-based game distribution
- [ ] Real-time multiplayer support

---

**Built with ❤️ for the arcade gaming community** 
