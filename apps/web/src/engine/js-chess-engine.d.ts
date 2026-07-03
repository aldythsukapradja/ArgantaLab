declare module 'js-chess-engine' {
  export interface BoardConfig {
    turn: 'white' | 'black'
    pieces: Record<string, string>
    moves?: Record<string, string[]>
    isFinished: boolean
    check: boolean
    checkMate: boolean
    castling?: unknown
    enPassant?: string | null
    halfMove?: number
    fullMove?: number
  }
  export class Game {
    constructor(config?: BoardConfig | string)
    move(from: string, to: string): Record<string, string>
    moves(from?: string): Record<string, string[]> | string[]
    aiMove(level?: number): Record<string, string>
    getHistory(): unknown[]
    exportJson(): BoardConfig
    exportFEN(): string
  }
  export function moves(config: BoardConfig | string): Record<string, string[]>
  export function status(config: BoardConfig | string): BoardConfig
  export function getFen(config: BoardConfig | string): string
  export function move(config: BoardConfig | string, from: string, to: string): BoardConfig
  export function aiMove(config: BoardConfig | string, level?: number): Record<string, string>
}
