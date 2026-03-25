import {
  ColorThemeKind,
  Range,
  TextEditor,
  ThemableDecorationAttachmentRenderOptions,
  ThemeColor,
  window,
  workspace,
} from "vscode";
import { TokenType } from "../leaderkey/command";

type ThemeType = "dark" | "light";
let globalThemeType: ThemeType = "dark";

export function updateGlobalThemeType() {
  switch (window.activeColorTheme.kind) {
    case ColorThemeKind.Dark:
    case ColorThemeKind.HighContrast:
      globalThemeType = "dark";
      break;
    case ColorThemeKind.Light:
    case ColorThemeKind.HighContrastLight:
      globalThemeType = "light";
      break;
    default:
      globalThemeType = "dark";
      break;
  }
}

export let stickyScrollMaxRows: number = 0;
export function updateStickyScrollConf() {
  const ss = workspace.getConfiguration("editor.stickyScroll");
  if (ss.get("enabled") === true) {
    stickyScrollMaxRows = ss.get("maxLineCount", 5);
  } else {
    stickyScrollMaxRows = 0;
  }
}
updateStickyScrollConf();

type BackgroundType = "default" | "header" | "border" | "cursor" | "gray" | "selection";

export type TextType =
  | TokenType
  | "dir"
  | "highlight"
  | "arrow-bold"
  | "error-bold"
  | "dim"
  | "dimdim";

// ---------------------------------------------------------------------------
// Color modes
// ---------------------------------------------------------------------------

export type ColorMode = "theme" | "classic" | "custom";

/**
 * Shape of leaderkey.colors.dark / leaderkey.colors.light in settings.json.
 * Used only when colorMode is "custom". All fields optional.
 */
export interface LeaderkeyColorConfig {
  background?: string;
  headerBackground?: string;
  selectionBackground?: string;
  border?: string;
  cursor?: string;
  grayBackground?: string;
  key?: string;
  dir?: string;
  arrow?: string;
  binding?: string;
  command?: string;
}

// ---------------------------------------------------------------------------
// "theme" mode — reads everything from the active VS Code theme via ThemeColor
// Both backgroundColor and color accept ThemeColor in the decoration API.
// ---------------------------------------------------------------------------

type BgTable = { [K in BackgroundType]: string | ThemeColor };
type TextTable = { [K in TextType]: ThemableDecorationAttachmentRenderOptions };

function buildThemeBgTable(): BgTable {
  return {
    default: new ThemeColor("editor.background"),
    header: new ThemeColor("titleBar.activeBackground"),
    selection: new ThemeColor("list.activeSelectionBackground"),
    border: new ThemeColor("focusBorder"),
    cursor: new ThemeColor("editorCursor.foreground"),
    gray: new ThemeColor("editorIndentGuide.background"),
  };
}

function buildThemeTextTable(): TextTable {
  const key = new ThemeColor("terminal.ansiMagenta");
  const arrow = new ThemeColor("terminal.ansiGreen");
  const binding = new ThemeColor("terminal.ansiBlue");
  const command = new ThemeColor("editor.foreground");
  const errorFg = new ThemeColor("errorForeground");
  return {
    key: { color: key, fontWeight: "bold" },
    dir: { color: key },
    arrow: { color: arrow },
    "arrow-bold": { color: arrow, fontWeight: "bold" },
    binding: { color: binding },
    highlight: { color: binding, fontWeight: "bold" },
    command: { color: command },
    // dim/dimdim: ThemeColor doesn't support alpha, so fall back to a muted token
    dim: { color: new ThemeColor("disabledForeground") },
    dimdim: { color: new ThemeColor("editorIndentGuide.activeBackground") },
    "error-bold": { color: errorFg, fontWeight: "bold" },
  };
}

// ---------------------------------------------------------------------------
// "classic" mode — original Spacemacs hardcoded palette, split dark/light
// ---------------------------------------------------------------------------

const classicDecoRenderOpts: { [T in ThemeType]: { [K in BackgroundType]: string } } = {
  dark: {
    default: "#292b2e",
    header: "#5d4d7a",
    selection: "#4f3d6a",
    border: "#68217A",
    cursor: "#BBB",
    gray: "#88888833",
  },
  light: {
    default: "#FAF7EC",
    header: "#E6E6EA",
    selection: "#d8d7e6",
    border: "#E7E5EB",
    cursor: "#444",
    gray: "#88888833",
  },
};

const classicThemeRenderOpts: { [T in ThemeType]: TextTable } = {
  dark: {
    dir: { color: "#bc6ec5" },
    key: { color: "#bc6ec5", fontWeight: "bold" },
    arrow: { color: "#2d9574" },
    "arrow-bold": { color: "#2d9574", fontWeight: "bold" },
    binding: { color: "#4190d8" },
    highlight: { color: "#4190d8", fontWeight: "bold" },
    command: { color: "#ccc" },
    dim: { color: "#ccc8" },
    dimdim: { color: "#ccc3" },
    "error-bold": { color: new ThemeColor("errorForeground"), fontWeight: "bold" },
  },
  light: {
    key: { color: "#692F60", fontWeight: "bold" },
    dir: { color: "#692F60" },
    arrow: { color: "#2A976D" },
    "arrow-bold": { color: "#2A976D", fontWeight: "bold" },
    binding: { color: "#3781C2" },
    highlight: { color: "#3781C2", fontWeight: "bold" },
    command: { color: "#67537A" },
    dim: { color: "#67537A80" },
    dimdim: { color: "#67537A30" },
    "error-bold": { color: new ThemeColor("errorForeground"), fontWeight: "bold" },
  },
};

// ---------------------------------------------------------------------------
// Active tables (rebuilt by buildColorTables)
// ---------------------------------------------------------------------------

let decoRenderOpts: { [T in ThemeType]: BgTable };
let themeRenderOpts: { [T in ThemeType]: TextTable };

function buildColorTables() {
  const cfg = workspace.getConfiguration("leaderkey");
  const mode: ColorMode = cfg.get("colorMode") ?? "theme";

  if (mode === "theme") {
    // Single table shared by both ThemeType values — ThemeColor resolves at render time.
    const bgTable = buildThemeBgTable();
    const txtTable = buildThemeTextTable();
    decoRenderOpts = { dark: bgTable, light: bgTable };
    themeRenderOpts = { dark: txtTable, light: txtTable };
    return;
  }

  if (mode === "classic") {
    decoRenderOpts = classicDecoRenderOpts;
    themeRenderOpts = classicThemeRenderOpts;
    return;
  }

  // mode === "custom" — merge user overrides onto classic defaults
  const userDark: LeaderkeyColorConfig = cfg.get("colors.dark") ?? {};
  const userLight: LeaderkeyColorConfig = cfg.get("colors.light") ?? {};

  function buildCustomBg(
    defaults: { [K in BackgroundType]: string },
    user: LeaderkeyColorConfig,
  ): BgTable {
    return {
      default: user.background ?? defaults.default,
      header: user.headerBackground ?? defaults.header,
      selection: user.selectionBackground ?? defaults.selection,
      border: user.border ?? defaults.border,
      cursor: user.cursor ?? defaults.cursor,
      gray: user.grayBackground ?? defaults.gray,
    };
  }

  function buildCustomText(defaults: TextTable, user: LeaderkeyColorConfig): TextTable {
    const commandColor = user.command ?? (defaults.command.color as string);
    const arrowColor = user.arrow ?? (defaults.arrow.color as string);
    const bindingColor = user.binding ?? (defaults.binding.color as string);
    return {
      key: { color: user.key ?? (defaults.key.color as string), fontWeight: "bold" },
      dir: { color: user.dir ?? (defaults.dir.color as string) },
      arrow: { color: arrowColor },
      "arrow-bold": { color: arrowColor, fontWeight: "bold" },
      binding: { color: bindingColor },
      highlight: { color: bindingColor, fontWeight: "bold" },
      command: { color: commandColor },
      dim: { color: commandColor + "88" },
      dimdim: { color: commandColor + "33" },
      "error-bold": { color: new ThemeColor("errorForeground"), fontWeight: "bold" },
    };
  }

  decoRenderOpts = {
    dark: buildCustomBg(classicDecoRenderOpts.dark, userDark),
    light: buildCustomBg(classicDecoRenderOpts.light, userLight),
  };
  themeRenderOpts = {
    dark: buildCustomText(classicThemeRenderOpts.dark, userDark),
    light: buildCustomText(classicThemeRenderOpts.light, userLight),
  };
}

buildColorTables();
export function updateColorConfig() {
  buildColorTables();
}

// ---------------------------------------------------------------------------

export type Decoration =
  | {
      type: "background";
      background?: BackgroundType;
      lines: number;
      width?: number;
      lineOffset?: number;
      charOffset?: number;
      zOffset?: number;
    }
  | {
      type: "text";
      background?: BackgroundType;
      foreground: TextType;
      lineOffset?: number;
      charOffset?: number;
      text: string;
      zOffset?: number;
    };

function escapeTextForBeforeContentText(text: string) {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll(" ", "\\00a0 ")
    .replace(/(\r\n|\r|\n)/g, " \\A ");
}

export function renderDecorations(
  decorations: Decoration[],
  editor: TextEditor,
  range: Range,
) {
  const dts = decorations.map((deco) => {
    switch (deco.type) {
      case "background":
        return window.createTextEditorDecorationType({
          color: "transparent",
          before: {
            contentText: "",
            backgroundColor: decoRenderOpts[globalThemeType][
              deco.background ?? "default"
            ] as any,
            height: `${100 * deco.lines}%`,
            width: `${deco.width ?? 200}ch`,
            margin: `0 -1ch 0 ${deco.charOffset !== undefined ? 0.5 + deco.charOffset : 0}ch;
                position: absolute; z-index: ${100 + (deco.zOffset ?? 0)};
                ${deco.lineOffset === undefined ? "" : `top: ${deco.lineOffset * 100}%;`}`,
          },
        });
      case "text":
        return window.createTextEditorDecorationType({
          color: "transparent",
          before: {
            fontWeight: "normal",
            ...themeRenderOpts[globalThemeType][deco.foreground],
            ...(deco.background === undefined
              ? {}
              : {
                  backgroundColor: decoRenderOpts[globalThemeType][
                    deco.background
                  ] as any,
                }),
            height: "100%",
            width: "200ch",
            margin: `0 -1ch 0 ${deco.charOffset ?? 0}ch; position: absolute; z-index: ${110 + (deco.zOffset ?? 0)}; padding-left: 0.5ch; white-space: pre;
               ${deco.lineOffset === undefined ? "" : `top: ${deco.lineOffset * 100}%;`}
               content: '${escapeTextForBeforeContentText(deco.text)}'`,
          },
        });
    }
  });
  dts.forEach((dt) => editor.setDecorations(dt, [range]));
  return dts;
}

export function getThemeRenderOpts(tokenType: TextType) {
  return themeRenderOpts[globalThemeType][tokenType];
}
