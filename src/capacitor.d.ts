declare module '@capacitor/app' {
  export interface AppPlugin {
    addListener(eventName: 'backButton', listener: (info: { canGoBack: boolean }) => void): Promise<void>;
    addListener(eventName: 'appStateChange', listener: (info: { isActive: boolean }) => void): Promise<void>;
    exitApp(): Promise<void>;
  }
  export const App: AppPlugin;
}

declare module '@capacitor/status-bar' {
  export interface StatusBarPlugin {
    setStyle(options: { style: string }): Promise<void>;
    setBackgroundColor(options: { color: string }): Promise<void>;
  }
  export const StatusBar: StatusBarPlugin;
}

declare module '@capacitor/splash-screen' {
  export interface SplashScreenPlugin {
    show(options?: { showDuration?: number; autoHide?: boolean }): Promise<void>;
    hide(): Promise<void>;
  }
  export const SplashScreen: SplashScreenPlugin;
}

declare module '@capacitor/screen-orientation' {
  export interface ScreenOrientationPlugin {
    lock(options: { orientation: string }): Promise<void>;
    unlock(): Promise<void>;
  }
  export const ScreenOrientation: ScreenOrientationPlugin;
}

declare module '@capacitor/preferences' {
  export interface PreferencesPlugin {
    get(options: { key: string }): Promise<{ value: string | null }>;
    set(options: { key: string; value: string }): Promise<void>;
    remove(options: { key: string }): Promise<void>;
  }
  export const Preferences: PreferencesPlugin;
}
