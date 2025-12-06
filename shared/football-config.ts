// Constants used for computing formation positions
const CENTER_X = 347;
const LOS_Y = 284;
const SPACING_UNIT = 30; // Offense spacing
const DEFENSE_SPACING = 60; // Defense spacing
const PLAYER_SIZE = 12;
const QB_Y = LOS_Y + PLAYER_SIZE + 4; // 300
const RB_Y = LOS_Y + 75; // 359

// Formation player template type (without id, which is generated at runtime)
export type FormationPlayer = {
  label: string;
  x: number;
  y: number;
  colorKey: string; // Reference to colors.offense.* or colors.defense.*
  side: "offense" | "defense";
};

export type FormationData = {
  name: string;
  description: string;
  players: FormationPlayer[];
};

export type FormationsConfig = {
  [size: string]: {
    offense: {
      [variation: string]: FormationData;
    };
    defense: {
      [variation: string]: FormationData;
    };
  };
};

export const FORMATIONS: FormationsConfig = {
  "5v5": {
    offense: {
      spread: {
        name: "5v5 Spread",
        description: "Shotgun QB with RB behind, 3 receivers spread wide",
        players: [
          { label: "QB", x: CENTER_X, y: QB_Y, colorKey: "offense.qb", side: "offense" },
          { label: "RB", x: CENTER_X, y: RB_Y, colorKey: "offense.rb", side: "offense" },
          { label: "Y", x: CENTER_X - (2 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.slotY", side: "offense" },
          { label: "Z", x: CENTER_X - (6 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.receiverZ", side: "offense" },
          { label: "X", x: CENTER_X + (6 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.receiverX", side: "offense" },
        ],
      },
    },
    defense: {
      base: {
        name: "5v5 Base",
        description: "3 LBs in W formation with 2 DBs deep",
        players: [
          { label: "LB", x: CENTER_X - (3.5 * DEFENSE_SPACING), y: LOS_Y - 40, colorKey: "defense.linebacker", side: "defense" },
          { label: "LB", x: CENTER_X, y: LOS_Y - 40, colorKey: "defense.linebacker", side: "defense" },
          { label: "LB", x: CENTER_X + (3.5 * DEFENSE_SPACING), y: LOS_Y - 40, colorKey: "defense.linebacker", side: "defense" },
          { label: "DB", x: CENTER_X - (1.8 * DEFENSE_SPACING), y: LOS_Y - 100, colorKey: "defense.secondary", side: "defense" },
          { label: "DB", x: CENTER_X + (1.8 * DEFENSE_SPACING), y: LOS_Y - 100, colorKey: "defense.secondary", side: "defense" },
        ],
      },
    },
  },
  "7v7": {
    offense: {
      spread: {
        name: "7v7 Spread",
        description: "Center, shotgun QB, RB, slot receivers and wide receivers",
        players: [
          { label: "C", x: CENTER_X, y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "QB", x: CENTER_X, y: QB_Y, colorKey: "offense.qb", side: "offense" },
          { label: "RB", x: CENTER_X, y: RB_Y, colorKey: "offense.rb", side: "offense" },
          { label: "Y", x: CENTER_X - (2.5 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.slotY", side: "offense" },
          { label: "TE", x: CENTER_X + (2.5 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.te", side: "offense" },
          { label: "Z", x: CENTER_X - (6.5 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.receiverZ", side: "offense" },
          { label: "X", x: CENTER_X + (6.5 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.receiverX", side: "offense" },
        ],
      },
    },
    defense: {
      base: {
        name: "7v7 Base",
        description: "1 DL, 3 LBs, 3 DBs",
        players: [
          { label: "DL", x: CENTER_X, y: LOS_Y - 20, colorKey: "defense.lineman", side: "defense" },
          { label: "LB", x: CENTER_X - (2.5 * DEFENSE_SPACING), y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "LB", x: CENTER_X, y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "LB", x: CENTER_X + (2.5 * DEFENSE_SPACING), y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "DB", x: CENTER_X - (3 * DEFENSE_SPACING), y: LOS_Y - 120, colorKey: "defense.secondary", side: "defense" },
          { label: "DB", x: CENTER_X, y: LOS_Y - 120, colorKey: "defense.secondary", side: "defense" },
          { label: "DB", x: CENTER_X + (3 * DEFENSE_SPACING), y: LOS_Y - 120, colorKey: "defense.secondary", side: "defense" },
        ],
      },
    },
  },
  "9v9": {
    offense: {
      spread: {
        name: "9v9 Spread",
        description: "3 interior linemen, 2 ends, 2 wideouts, QB and RB",
        players: [
          { label: "C", x: CENTER_X, y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "LG", x: CENTER_X - (1 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "RG", x: CENTER_X + (1 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "Y", x: CENTER_X - (3 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.slotY", side: "offense" },
          { label: "TE", x: CENTER_X + (3 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.te", side: "offense" },
          { label: "Z", x: CENTER_X - (7 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.receiverZ", side: "offense" },
          { label: "X", x: CENTER_X + (7 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.receiverX", side: "offense" },
          { label: "QB", x: CENTER_X, y: QB_Y, colorKey: "offense.qb", side: "offense" },
          { label: "RB", x: CENTER_X, y: RB_Y, colorKey: "offense.rb", side: "offense" },
        ],
      },
    },
    defense: {
      base: {
        name: "9v9 Base",
        description: "3 DL, 3 LBs, 3 DBs",
        players: [
          { label: "DL", x: CENTER_X - (1.5 * DEFENSE_SPACING), y: LOS_Y - 20, colorKey: "defense.lineman", side: "defense" },
          { label: "DL", x: CENTER_X, y: LOS_Y - 20, colorKey: "defense.lineman", side: "defense" },
          { label: "DL", x: CENTER_X + (1.5 * DEFENSE_SPACING), y: LOS_Y - 20, colorKey: "defense.lineman", side: "defense" },
          { label: "LB", x: CENTER_X - (2.5 * DEFENSE_SPACING), y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "LB", x: CENTER_X, y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "LB", x: CENTER_X + (2.5 * DEFENSE_SPACING), y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "DB", x: CENTER_X - (3.5 * DEFENSE_SPACING), y: LOS_Y - 120, colorKey: "defense.secondary", side: "defense" },
          { label: "DB", x: CENTER_X, y: LOS_Y - 120, colorKey: "defense.secondary", side: "defense" },
          { label: "DB", x: CENTER_X + (3.5 * DEFENSE_SPACING), y: LOS_Y - 120, colorKey: "defense.secondary", side: "defense" },
        ],
      },
    },
  },
  "11v11": {
    offense: {
      spread: {
        name: "11v11 Spread",
        description: "Full offensive line, TE, slot, 2 wideouts, QB and RB",
        players: [
          { label: "C", x: CENTER_X, y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "LG", x: CENTER_X - (1 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "RG", x: CENTER_X + (1 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "LT", x: CENTER_X - (2 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "RT", x: CENTER_X + (2 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.default", side: "offense" },
          { label: "Y", x: CENTER_X - (3 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.slotY", side: "offense" },
          { label: "TE", x: CENTER_X + (3 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.te", side: "offense" },
          { label: "Z", x: CENTER_X - (7 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.receiverZ", side: "offense" },
          { label: "X", x: CENTER_X + (7 * SPACING_UNIT), y: LOS_Y, colorKey: "offense.receiverX", side: "offense" },
          { label: "QB", x: CENTER_X, y: QB_Y, colorKey: "offense.qb", side: "offense" },
          { label: "RB", x: CENTER_X, y: RB_Y, colorKey: "offense.rb", side: "offense" },
        ],
      },
    },
    defense: {
      base: {
        name: "11v11 4-3",
        description: "4 DL (2 DE, 2 DT), 3 LBs, 2 CBs, 2 Safeties",
        players: [
          { label: "DE", x: CENTER_X - (2 * DEFENSE_SPACING), y: LOS_Y - 20, colorKey: "defense.lineman", side: "defense" },
          { label: "DT", x: CENTER_X - (0.75 * DEFENSE_SPACING), y: LOS_Y - 20, colorKey: "defense.lineman", side: "defense" },
          { label: "DT", x: CENTER_X + (0.75 * DEFENSE_SPACING), y: LOS_Y - 20, colorKey: "defense.lineman", side: "defense" },
          { label: "DE", x: CENTER_X + (2 * DEFENSE_SPACING), y: LOS_Y - 20, colorKey: "defense.lineman", side: "defense" },
          { label: "LB", x: CENTER_X - (2.5 * DEFENSE_SPACING), y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "LB", x: CENTER_X, y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "LB", x: CENTER_X + (2.5 * DEFENSE_SPACING), y: LOS_Y - 60, colorKey: "defense.linebacker", side: "defense" },
          { label: "CB", x: CENTER_X - (5 * DEFENSE_SPACING), y: LOS_Y - 40, colorKey: "defense.secondary", side: "defense" },
          { label: "CB", x: CENTER_X + (5 * DEFENSE_SPACING), y: LOS_Y - 40, colorKey: "defense.secondary", side: "defense" },
          { label: "SS", x: CENTER_X - (2 * DEFENSE_SPACING), y: LOS_Y - 140, colorKey: "defense.secondary", side: "defense" },
          { label: "FS", x: CENTER_X + (2 * DEFENSE_SPACING), y: LOS_Y - 140, colorKey: "defense.secondary", side: "defense" },
        ],
      },
    },
  },
};

export const FOOTBALL_CONFIG = {
  field: {
    width: 694,
    height: 392,
    losY: 284,
    pixelsPerYard: 12,
    headerHeight: 60,
    sidePadding: 27,
    bottomPadding: 12,
    centerX: CENTER_X,
    spacingUnit: SPACING_UNIT,
    defenseSpacing: DEFENSE_SPACING,
    get fieldTop() { return this.headerHeight; },
    get fieldLeft() { return this.sidePadding; },
    get fieldRight() { return this.width - this.sidePadding; },
    get fieldWidth() { return this.width - this.sidePadding * 2; },
    get fieldHeight() { return this.height - this.headerHeight; },
    get leftHashX() { return this.fieldLeft + 160; },
    get rightHashX() { return this.fieldRight - 160; },
  },
  colors: {
    offense: {
      qb: "#000000",
      rb: "#39ff14",
      slotY: "#eab308",
      te: "#f97316",
      receiverZ: "#1d4ed8",
      receiverX: "#ef4444",
      default: "#6b7280",
    },
    defense: {
      lineman: "#FFB6C1",
      linebacker: "#87CEEB",
      secondary: "#9333ea",
    },
    routes: {
      primary: "#ef4444",
      blitz: "#ef4444",
      man: "#9ca3af",
      zone: "#06b6d4",
      blocking: "#ffffff",
      run: "#000000",
    },
    ui: {
      selection: "#06b6d4",
    },
    shapes: {
      pink: "#ec4899",
      blue: "#1d4ed8",
      green: "#86efac",
    },
  },
  labels: {
    offense: {
      "#000000": "QB",
      "#39ff14": "RB",
      "#1d4ed8": "Z",
      "#eab308": "Y",
      "#ef4444": "X",
      "#f97316": "TE",
    } as Record<string, string>,
    defense: {
      "#FFB6C1": "DL",
      "#87CEEB": "LB",
      "#9333ea": "DB",
    } as Record<string, string>,
  },
  positions: {
    offense: {
      qb: { description: "Quarterback - behind center", yOffset: 1 },
      rb: { description: "Running back - 6 yards behind LOS", yOffset: 6 },
      slotY: { description: "Y receiver/Slot - inside position", xSlot: -2 },
      te: { description: "Tight end - outside tackle", xSlot: 3 },
      receiverZ: { description: "Z receiver/Split end - far left", xSlot: -7 },
      receiverX: { description: "X receiver/Flanker - far right", xSlot: 7 },
    },
    defense: {
      lineman: { description: "Defensive linemen - on the line of scrimmage", yOffset: -1 },
      linebacker: { description: "Linebackers - 3-5 yards behind LOS", yOffset: -4 },
      secondary: { description: "Defensive backs - 7-10 yards behind LOS", yOffset: -8 },
    },
  },
  logicRules: {
    playAction: {
      triggers: ["PA", "play action", "play-action", "fake handoff"],
      outputFlag: "hasPlayAction",
      description: "Fake handoff to running back before passing",
    },
    motion: {
      triggers: ["motion", "pre-snap motion", "shift"],
      outputFlag: "preSnapMotion",
      description: "Player moves before the snap",
    },
    blitz: {
      triggers: ["blitz", "rush", "pressure"],
      routeType: "blitz",
      description: "Defender rushes the quarterback",
    },
    screen: {
      triggers: ["screen", "bubble", "quick screen"],
      description: "Quick pass behind or at the line of scrimmage",
    },
    deep: {
      triggers: ["deep", "go route", "fly", "streak", "bomb"],
      description: "Long pass downfield",
    },
  },
  routeTypes: {
    pass: ["straight", "curved", "post", "corner", "slant", "out", "in", "comeback", "go"],
    run: ["straight", "curved", "sweep", "dive", "counter"],
    blocking: ["pass protection", "run blocking", "pull"],
  },
  formationTemplates: {
    offense: {
      shotgun: "QB 5 yards behind center, RB beside or behind QB",
      iFormation: "QB under center, FB and RB stacked behind",
      singleback: "QB under center or shotgun, single RB",
      spread: "4-5 receivers spread wide, shotgun QB",
      pistol: "QB 3-4 yards behind center, RB directly behind QB",
    },
    defense: {
      "4-3": "4 defensive linemen, 3 linebackers",
      "3-4": "3 defensive linemen, 4 linebackers",
      nickel: "5 defensive backs, used against passing",
      dime: "6 defensive backs, used against heavy passing",
      cover2: "2 deep safeties, 5 underneath defenders",
      cover3: "3 deep defenders, 4 underneath",
    },
  },
};

export type FootballConfig = typeof FOOTBALL_CONFIG;

// Utility function to resolve colorKey (e.g., "offense.qb") to actual hex color
export function resolveColorKey(colorKey: string): string {
  const [category, key] = colorKey.split('.') as ['offense' | 'defense', string];
  const colors = FOOTBALL_CONFIG.colors[category] as Record<string, string>;
  return colors[key] || "#6b7280";
}

// Utility to get formation data by size, side, and variation
export function getFormation(
  size: "5v5" | "7v7" | "9v9" | "11v11",
  side: "offense" | "defense",
  variation: string = side === "offense" ? "spread" : "base"
): FormationData | undefined {
  return FORMATIONS[size]?.[side]?.[variation];
}
