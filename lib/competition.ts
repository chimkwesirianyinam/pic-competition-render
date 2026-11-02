export type Session = { code: string; secret?: string; id?: string; token?: string };
export type Team = { id: string; name: string; enabled: number; score: number; logo: string | null; sort: number; averageMs: number | null };
export type Student = { id: string; team: string | null; seat: number | null; name: string; joined: number; averageMs: number | null; score: number };
export type Buzz = { id: number; player: string; name: string; at: number; team: string | null; responseMs: number | null; verdict: number | null };
export type Game = { code: string; title: string; round: number; competitionRound: number; question: number; roundCount: number; questionCount: number; timeLimit: number; phase: 'ready' | 'live' | 'scores'; roundLocked: number; startedAt: number | null; armed: number; multipleBuzzes: number; schoolLogo: string | null; competitionLogo: string | null; teams: Team[]; players: Student[]; buzzes: Buzz[] };
export const CLASS_NAMES = ['SS1 Sapphire','SS1 Emerald','SS2 Sapphire','SS2 Emerald','SS3 Sapphire','SS3 Emerald'];
export function logoUrl(key: string | null | undefined) { return key ? '/api/logo?key=' + encodeURIComponent(key) : undefined; }

export function responseTime(ms: number | null | undefined) { return ms == null ? '—' : (ms / 1000).toFixed(2) + ' s'; }
export function validSessionCode(code: string) { return /^PIC-\d{2}[A-Z]$/.test(code) || /^[A-F0-9]{6}$/.test(code); }
