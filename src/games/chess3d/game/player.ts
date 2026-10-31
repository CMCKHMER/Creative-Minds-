/** Local player identity for the chess cartridge (trimmed from the
 * original clientApi — the online-server parts don't exist on GitHub Pages). */

export function getPlayerName(): string {
  try {
    return window.localStorage.getItem("chess3d:name") ?? "";
  } catch {
    return "";
  }
}

export function setPlayerName(name: string) {
  try {
    window.localStorage.setItem("chess3d:name", name.trim().slice(0, 20));
  } catch {
    /* private mode — name just won't persist */
  }
}
