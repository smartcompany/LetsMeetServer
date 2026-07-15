import { BotConfig, BotLog, BotState } from "./types";

function defaultConfig(): BotConfig {
  return {
    creatorRatio: 1,
    applicationsPerRunPerBot: 2,
    applyOnlyToBotMeetings: true,
    updatedAt: new Date().toISOString(),
  };
}

const inMemoryState: BotState = {
  config: defaultConfig(),
};

export async function readBotState(): Promise<BotState> {
  return inMemoryState;
}

export async function writeBotState(state: BotState): Promise<void> {
  inMemoryState.config = { ...state.config };
}

/** 서버 콘솔 로깅만 수행 (Vercel 로그에서 확인) */
export function appendLog(log: Omit<BotLog, "id" | "ts">): BotLog {
  const entry: BotLog = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    ...log,
  };
  const prefix = `[${entry.ts}] [letsmeet] [${entry.level.toUpperCase()}]`;
  console.log(prefix, entry.message);
  return entry;
}

export function toBotStateApiError(error: unknown): { status: number; error: string } {
  const message = error instanceof Error ? error.message : "Unknown error";
  return { status: 500, error: message };
}
