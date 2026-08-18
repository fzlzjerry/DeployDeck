import { BrowserWindow, nativeTheme, screen } from "electron";
import path from "node:path";
import { getPreferences, getWindowBounds, setWindowBounds } from "./preferences";

let mainWindow: BrowserWindow | null = null;

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 820;
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 680;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const prefs = await getPreferences();
  const saved = await getWindowBounds();
  const display = screen.getPrimaryDisplay().workArea;
  const width = Math.min(Math.max(saved?.width ?? DEFAULT_WIDTH, MIN_WIDTH), display.width);
  const height = Math.min(Math.max(saved?.height ?? DEFAULT_HEIGHT, MIN_HEIGHT), display.height);
  const x = saved ? Math.min(Math.max(saved.x, display.x), display.x + display.width - 200) : undefined;
  const y = saved ? Math.min(Math.max(saved.y, display.y), display.y + display.height - 200) : undefined;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: "DeployDeck",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#111318" : "#f8f7f5",
    show: !prefs.startMinimized,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  try {
    if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === "string" && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      const name = typeof MAIN_WINDOW_VITE_NAME === "string" ? MAIN_WINDOW_VITE_NAME : "main_window";
      await mainWindow.loadFile(path.join(__dirname, `../renderer/${name}/index.html`));
    }
  } catch (error) {
    console.error("Failed to load the DeployDeck window", error);
  }

  const persist = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    const bounds = mainWindow.getBounds();
    void setWindowBounds(bounds);
  };
  mainWindow.on("resize", persist);
  mainWindow.on("move", persist);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

export function sendToRenderer(channel: string, payload?: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}
