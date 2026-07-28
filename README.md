# STARDRIFT - Space Arcade Game

Navigate your ship through asteroid fields, collect glowing stars, and survive as long as you can in this fast-paced space arcade game. Built with React, TypeScript, Canvas 2D, and Capacitor.

## Features

- 🚀 **Tight Controls** - WASD/Arrow keys, virtual joystick, and fire button
- 🔊 **Arcade Sound** - Responsive firing, collection, explosion, and game-over effects
- ⭐ **Score System** - Collect stars for points, difficulty scales with score
- 💥 **Juicy Feedback** - Screen shake, particle explosions, glowing effects
- 📱 **Mobile Ready** - Full touch support, portrait orientation
- 🏆 **High Scores** - Local leaderboard with top 10 scores
- ⏸️ **Pause & Resume** - ESC/P key or touch button
- 🎨 **Polished Visuals** - Indigo/yellow space aesthetic, particle system

## Store Deployment

### iOS (App Store)

```bash
# Prerequisites: Xcode 15+, macOS, Apple Developer account
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

In Xcode:
1. Set your Team (Signing & Capabilities)
2. Update Bundle Identifier if needed
3. Set deployment target to iOS 15.0+
4. Build and Archive (Product > Archive)
5. Upload to App Store Connect

### Android (Google Play)

```bash
# Prerequisites: Android Studio, JDK 17+
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio:
1. Generate a signed bundle/APK (Build > Generate Signed Bundle/APK)
2. Create a keystore if you don't have one
3. Upload the AAB to Google Play Console

### Web (PWA)

The app is a fully functional Progressive Web App. Deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages).

## Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS 4** - Styling
- **Canvas 2D** - Game rendering at 60fps
- **Capacitor 8** - Native app wrapper for iOS & Android

## Project Structure

```
src/
├── App.tsx              # Main app with game state management
├── main.tsx             # Entry point with Capacitor init
├── index.css            # Tailwind + custom animations
├── components/
│   ├── Game.tsx         # Core game engine (canvas, physics, rendering)
│   ├── StartScreen.tsx  # Start screen with high scores
│   ├── GameOver.tsx     # Game over overlay
│   └── PauseOverlay.tsx # Pause menu
└── utils/
    └── scores.ts        # localStorage high score management
```

## License

MIT
