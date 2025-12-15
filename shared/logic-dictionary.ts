export const LOGIC_DICTIONARY = {
  offense: {
    formations: {
      "5v5 Spread": {
        rule: "Center at LOS. QB at LOS+28. RB at LOS+75. 2 Receivers split wide (X left at sideline, Z right at sideline).",
        playerCount: 5
      },
      "5v5 Bunch": {
        rule: "Center at LOS. QB at LOS+28. 3 receivers clustered tight on one side (spacing < 20px between each).",
        playerCount: 5
      },
      "7v7 Spread": {
        rule: "Center at LOS. QB at LOS+28. RB behind QB. 4 Receivers split (2 left, 2 right) at various depths.",
        playerCount: 7
      },
      "7v7 Trips": {
        rule: "Center at LOS. QB at LOS+28. 3 receivers stacked on strong side (Z, Y, Slot). 1 receiver weak side (X).",
        playerCount: 7
      },
      "7v7 Bunch": {
        rule: "Center at LOS. QB at LOS+28. Triangle cluster of 3 receivers on one side (spacing < 15px). 1 receiver opposite.",
        playerCount: 7
      },
      "Empty": {
        rule: "No RB in backfield. All skill players split out as receivers.",
        playerCount: 5
      },
      "Shotgun": {
        rule: "QB positioned 5 yards behind center (LOS+60). RB next to or behind QB.",
        playerCount: 5
      }
    },
    routeTree: {
      "Flat": {
        style: "straight",
        rule: "Quick out to sideline, 3 yards depth. Short horizontal route.",
        depth: "short"
      },
      "Slant": {
        style: "straight",
        rule: "3 steps vertical (15px), then 45-degree cut inside toward middle of field.",
        depth: "short"
      },
      "Out": {
        style: "straight",
        rule: "Run 5-7 yards vertical, sharp 90-degree cut toward sideline.",
        depth: "medium"
      },
      "In": {
        style: "straight",
        rule: "Run 5-7 yards vertical, sharp 90-degree cut toward middle of field (dig route).",
        depth: "medium"
      },
      "Curl": {
        style: "curved",
        rule: "Run 8-10 yards vertical, turn back toward QB. Receiver faces line of scrimmage.",
        depth: "medium"
      },
      "Comeback": {
        style: "straight",
        rule: "Run 12-15 yards vertical, sharp cut back toward sideline at 45 degrees.",
        depth: "deep"
      },
      "Corner": {
        style: "straight",
        rule: "Run 10-12 yards vertical, 45-degree cut toward back pylon/corner of end zone.",
        depth: "deep"
      },
      "Post": {
        style: "straight",
        rule: "Run 10-12 yards vertical, 45-degree cut toward goalpost/middle of field.",
        depth: "deep"
      },
      "Go": {
        style: "straight",
        rule: "Vertical sprint straight up field. No cuts. Also called Fly or Streak.",
        depth: "deep"
      },
      "Wheel": {
        style: "curved",
        rule: "Start toward flat/sideline, then curve upfield vertically. Often run by RBs.",
        depth: "deep"
      },
      "Drag": {
        style: "straight",
        rule: "Shallow cross underneath, running horizontally across field at 2-3 yard depth.",
        depth: "short"
      },
      "Crosser": {
        style: "straight",
        rule: "Deep cross at 10-15 yards, running horizontally across entire field.",
        depth: "medium"
      },
      "Seam": {
        style: "straight",
        rule: "Vertical route splitting between defenders, usually between hash marks.",
        depth: "deep"
      }
    },
    concepts: {
      "Mesh": {
        rule: "Two receivers cross underneath at shallow depth, creating rub/pick action.",
        routes: ["Drag", "Drag"]
      },
      "Smash": {
        rule: "Corner route paired with hitch/curl underneath. High-low read.",
        routes: ["Corner", "Curl"]
      },
      "Four Verticals": {
        rule: "All receivers run Go routes, stretching defense vertically.",
        routes: ["Go", "Go", "Go", "Go"]
      },
      "Flood": {
        rule: "Three routes to same side at three different depths (flat, out, corner).",
        routes: ["Flat", "Out", "Corner"]
      },
      "Screen": {
        rule: "Quick throw behind LOS to receiver/RB with blockers in front.",
        routes: ["Flat"]
      }
    }
  },
  defense: {
    formations: {
      "5v5 Base": {
        rule: "1 Rusher (LB color) at LOS-40px. 2 Linebackers split wide at LOS-60px. 2 Safeties (DB color) deep at LOS-120px.",
        playerCount: 5
      },
      "Cover 1": {
        rule: "Man coverage on all receivers. 1 deep safety in center of field.",
        coverage: "man"
      },
      "Cover 2": {
        rule: "2 Safeties deep splitting field in half. Corners play flat zones.",
        coverage: "zone"
      },
      "Cover 3": {
        rule: "3 deep defenders (2 corners + 1 safety) each covering third of field.",
        coverage: "zone"
      },
      "Cover 4": {
        rule: "4 deep defenders each covering quarter of field. Prevents deep passes.",
        coverage: "zone"
      },
      "Man": {
        rule: "Each defender assigned to specific offensive player. Follow them everywhere.",
        coverage: "man"
      },
      "Zone": {
        rule: "Defenders cover areas of field rather than specific players.",
        coverage: "zone"
      },
      "Blitz": {
        rule: "Send extra defenders to rush QB. Draw red linear arrow from rusher to QB position.",
        coverage: "aggressive"
      }
    },
    assignments: {
      "Blitz": {
        style: "linear",
        color: "routes.blitz",
        rule: "Red solid line from defender directly to QB position."
      },
      "Man": {
        style: "linear",
        color: "routes.man",
        rule: "Gray dotted line from defender to assigned offensive player."
      },
      "Zone": {
        style: "area",
        rule: "Defender covers an area. Show with zone shape (circle, oval, or rectangle)."
      }
    }
  },
  mechanics: {
    "Play Action": {
      flag: "hasPlayAction",
      rule: "QB fakes handoff to RB before passing. Toggle play-action marker on canvas.",
      visual: "Show 'PA' indicator near QB position."
    },
    "Motion": {
      flag: "preSnapMotion",
      rule: "One receiver moves laterally before snap. Show motion route as dashed line before LOS.",
      visual: "Dotted route line showing pre-snap movement path."
    },
    "RPO": {
      flag: "hasRPO",
      rule: "Run-Pass Option. QB reads defender to decide run or pass post-snap.",
      visual: "Show both run and pass option routes from RB/receivers."
    },
    "Jet Sweep": {
      flag: "hasJetSweep",
      rule: "Receiver motions across formation and takes handoff running horizontally.",
      visual: "Motion route with run continuation."
    }
  },
  keywords: {
    formationTriggers: ["spread", "bunch", "trips", "empty", "shotgun", "pistol", "i-form", "stack"],
    routeTriggers: ["flat", "slant", "out", "in", "curl", "comeback", "corner", "post", "go", "fly", "streak", "wheel", "drag", "cross", "seam"],
    defenseTriggers: ["cover 1", "cover 2", "cover 3", "cover 4", "man", "zone", "blitz", "press"],
    mechanicTriggers: ["play action", "play-action", "pa", "motion", "jet", "rpo", "screen", "draw"]
  }
};

export const SITUATIONAL_TAGS: Record<string, string[]> = {
  '5v5': ['No Run Zone (<5 yds)', 'Midfield', 'Backed Up'],
  '7v7': ['Red Zone (<20)', 'Goal Line (<10)', 'Open Field', 'Backed Up'],
  '9v9': ['Red Zone (<20)', 'Goal Line (<10)', 'Open Field', 'Backed Up'],
  '11v11': ['Red Zone', 'Goal Line', '2-Minute', '4-Minute', 'Backed Up']
};
