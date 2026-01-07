import { toPng } from "html-to-image";
import { createRoot } from "react-dom/client";

interface Coach {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

interface Player {
  id: number;
  firstName: string;
  lastName: string;
  position1?: string | null;
  position2?: string | null;
  defPosition1?: string | null;
  mainColor?: string | null;
}

interface SplitPlayer {
  id: number;
  playerId: number;
  squadName: string;
  player: {
    id: number;
    firstName: string;
    lastName: string;
    position1?: string | null;
    position2?: string | null;
    defPosition1?: string | null;
    mainColor?: string | null;
  };
}

interface RosterPageProps {
  teamName: string;
  coaches: Coach[];
  players: Player[];
}

interface SplitsPageProps {
  teamName: string;
  splits: SplitPlayer[];
}

function parseColors(colorString: string | null | undefined): string[] {
  if (!colorString) return [];
  return colorString.split(',').map(c => c.trim()).filter(c => c.length > 0).slice(0, 4);
}

function isColorDark(color: string): boolean {
  if (!color) return false;
  const lowerColor = color.toLowerCase().trim();
  const lightColorNames = ['yellow', 'white', 'cyan', 'lime', 'aqua', 'lightyellow', 'lightgreen', 'lightblue', 'pink', 'orange', 'gold', 'beige', 'ivory', 'lavender', 'coral', 'peach', 'cream', 'tan', 'wheat', 'khaki', 'lemon'];
  if (lightColorNames.includes(lowerColor)) return false;
  const darkColorNames = ['black', 'navy', 'darkblue', 'darkgreen', 'darkred', 'maroon', 'purple', 'indigo', 'blue', 'green', 'red', 'brown', 'gray', 'grey', 'teal', 'olive'];
  if (darkColorNames.includes(lowerColor)) return true;
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return true;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance < 128;
}

function RosterPageForExport({ teamName, coaches, players }: RosterPageProps) {
  const sortedCoaches = [...coaches].sort((a, b) => a.lastName.localeCompare(b.lastName));
  const sortedPlayers = [...players].sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <div style={{
      width: 850,
      minHeight: 1100,
      backgroundColor: '#ffffff',
      padding: 40,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1f2937',
    }}>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: '#ea580c',
        marginBottom: 8,
        textAlign: 'center',
      }}>
        {teamName}
      </div>
      <div style={{
        fontSize: 20,
        fontWeight: 600,
        color: '#374151',
        marginBottom: 32,
        textAlign: 'center',
      }}>
        Team Roster
      </div>

      {coaches.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#ea580c',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '2px solid #fed7aa',
          }}>
            Coaching Staff
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Name</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {sortedCoaches.map((coach, idx) => (
                <tr key={coach.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>{coach.firstName} {coach.lastName}</td>
                  <td style={{ padding: '10px 12px', fontSize: 14, color: '#6b7280' }}>{coach.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {players.length > 0 && (
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#ea580c',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '2px solid #fed7aa',
          }}>
            Players ({players.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Name</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Offense</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Defense</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Color</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, idx) => {
                const colors = parseColors(player.mainColor);
                return (
                  <tr key={player.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>{player.firstName} {player.lastName}</td>
                    <td style={{ padding: '10px 12px', fontSize: 14, color: '#6b7280' }}>
                      {[player.position1, player.position2].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 14, color: '#6b7280' }}>
                      {player.defPosition1 || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {colors.slice(0, 2).map((color, i) => (
                          <span key={i} style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: '1px solid #d1d5db',
                          }} />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SplitsPageForExport({ teamName, splits }: SplitsPageProps) {
  const squad1 = splits.filter(s => s.squadName === 'Squad 1').sort((a, b) => a.player.lastName.localeCompare(b.player.lastName));
  const squad2 = splits.filter(s => s.squadName === 'Squad 2').sort((a, b) => a.player.lastName.localeCompare(b.player.lastName));

  const renderSquad = (squadName: string, players: SplitPlayer[]) => (
    <div style={{ flex: 1, minWidth: 350 }}>
      <div style={{
        fontSize: 16,
        fontWeight: 600,
        color: '#ea580c',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '2px solid #fed7aa',
      }}>
        {squadName} ({players.length}/6)
      </div>
      {players.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Position</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Color</th>
            </tr>
          </thead>
          <tbody>
            {players.map((split, idx) => {
              const colors = parseColors(split.player.mainColor);
              const positions = [split.player.position1, split.player.defPosition1].filter(Boolean).join(' / ');
              return (
                <tr key={split.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>
                    {split.player.firstName} {split.player.lastName}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 14, color: '#6b7280' }}>
                    {positions || '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {colors.slice(0, 2).map((color, i) => (
                        <span key={i} style={{
                          display: 'inline-block',
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: color,
                          border: '1px solid #d1d5db',
                        }} />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
          No players assigned
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      width: 850,
      minHeight: 1100,
      backgroundColor: '#ffffff',
      padding: 40,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1f2937',
    }}>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: '#ea580c',
        marginBottom: 8,
        textAlign: 'center',
      }}>
        {teamName}
      </div>
      <div style={{
        fontSize: 20,
        fontWeight: 600,
        color: '#374151',
        marginBottom: 32,
        textAlign: 'center',
      }}>
        Team Splits
      </div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {renderSquad('Squad 1', squad1)}
        {renderSquad('Squad 2', squad2)}
      </div>
    </div>
  );
}

export interface RenderedPageImage {
  base64: string;
  width: number;
  height: number;
}

export async function renderRosterPageToBase64(
  teamName: string,
  coaches: Coach[],
  players: Player[],
  pixelRatio: number = 2
): Promise<RenderedPageImage> {
  return new Promise((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      <RosterPageForExport
        teamName={teamName}
        coaches={coaches}
        players={players}
      />
    );

    setTimeout(async () => {
      try {
        const element = container.firstChild as HTMLElement;
        if (!element) {
          throw new Error("Failed to render roster page element");
        }

        const dataUrl = await toPng(element, {
          quality: 1.0,
          pixelRatio: pixelRatio,
          backgroundColor: '#ffffff',
        });

        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        const width = element.offsetWidth * pixelRatio;
        const height = element.offsetHeight * pixelRatio;

        root.unmount();
        document.body.removeChild(container);

        resolve({ base64, width, height });
      } catch (error) {
        root.unmount();
        document.body.removeChild(container);
        reject(error);
      }
    }, 150);
  });
}

export async function renderSplitsPageToBase64(
  teamName: string,
  splits: SplitPlayer[],
  pixelRatio: number = 2
): Promise<RenderedPageImage> {
  return new Promise((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      <SplitsPageForExport
        teamName={teamName}
        splits={splits}
      />
    );

    setTimeout(async () => {
      try {
        const element = container.firstChild as HTMLElement;
        if (!element) {
          throw new Error("Failed to render splits page element");
        }

        const dataUrl = await toPng(element, {
          quality: 1.0,
          pixelRatio: pixelRatio,
          backgroundColor: '#ffffff',
        });

        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        const width = element.offsetWidth * pixelRatio;
        const height = element.offsetHeight * pixelRatio;

        root.unmount();
        document.body.removeChild(container);

        resolve({ base64, width, height });
      } catch (error) {
        root.unmount();
        document.body.removeChild(container);
        reject(error);
      }
    }, 150);
  });
}
