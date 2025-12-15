import { SITUATIONAL_TAGS } from "../../../shared/logic-dictionary";

export type GameFormat = '5v5' | '7v7' | '9v9' | '11v11';

export function detectGameFormat(playerCount: number, explicitFormat?: string): GameFormat {
  if (explicitFormat && explicitFormat in SITUATIONAL_TAGS) {
    return explicitFormat as GameFormat;
  }
  
  if (playerCount <= 12) return '5v5';
  if (playerCount <= 16) return '7v7';
  if (playerCount <= 20) return '9v9';
  return '11v11';
}

export function getSituationalTags(format: GameFormat): string[] {
  return SITUATIONAL_TAGS[format] || [];
}
