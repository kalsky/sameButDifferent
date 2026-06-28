import type { Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  dracula,
  cobalt,
  tomorrow,
  coolGlow,
  espresso,
  birdsOfParadise,
  amy,
  solarizedLight,
  ayuLight,
  rosePineDawn,
  clouds,
} from "thememirror";

// Name -> CodeMirror theme extension (theme + syntax highlight style).
export const THEMES: Record<string, Extension> = {
  "One Dark": oneDark,
  Dracula: dracula,
  Cobalt: cobalt,
  Tomorrow: tomorrow,
  "Cool Glow": coolGlow,
  Espresso: espresso,
  "Birds of Paradise": birdsOfParadise,
  Amy: amy,
  "Solarized Light": solarizedLight,
  "Ayu Light": ayuLight,
  "Rosé Pine Dawn": rosePineDawn,
  Clouds: clouds,
};

export const THEME_NAMES = Object.keys(THEMES);

export function themeExt(name: string): Extension {
  return THEMES[name] ?? oneDark;
}
