import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar } from "@capacitor/status-bar";
import "./index.css";
import App from "./App";

async function initNativeGameShell() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.hide();
    await ScreenOrientation.lock({ orientation: "portrait" });
    await CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      void CapacitorApp.exitApp();
    });
  } catch {
    // The game remains playable if a device does not expose one of these APIs.
  } finally {
    await SplashScreen.hide().catch(() => undefined);
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void initNativeGameShell();
