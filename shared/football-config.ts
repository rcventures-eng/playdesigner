export const FOOTBALL_CONFIG = {
  field: {
    width: 694,
    height: 392,
    losY: 284,
    pixelsPerYard: 12,
    headerHeight: 60,
    sidePadding: 27,
    bottomPadding: 12,
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
