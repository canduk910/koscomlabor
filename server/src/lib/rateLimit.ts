/**
 * 인메모리 슬라이딩 윈도 rate limiter (명세 4.3절).
 *
 * VM 1대·단일 프로세스 전제로 메모리 저장을 사용한다.
 * 프로세스 재시작 시 카운터 초기화는 수용된 트레이드오프.
 * 키는 원문 IP가 아닌 IP 해시를 사용해도 되지만, 메모리에만 존재하고
 * 윈도 경과 시 소멸하므로 원문 키를 쓰되 저장·로깅하지 않는다 (명세 4.1절).
 */

export interface WindowRule {
  /** 윈도 길이 (ms) */
  windowMs: number;
  /** 윈도 내 최대 허용 횟수 */
  max: number;
}

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

interface KeyState {
  /** 이벤트 타임스탬프 (ms) — 가장 긴 윈도 기준으로 유지 */
  timestamps: number[];
}

export class SlidingWindowLimiter {
  private readonly rules: WindowRule[];
  private readonly longestWindowMs: number;
  private readonly states = new Map<string, KeyState>();

  constructor(rules: WindowRule[]) {
    if (rules.length === 0) throw new Error("rate limit 규칙이 비어 있습니다.");
    this.rules = rules;
    this.longestWindowMs = Math.max(...rules.map((rule) => rule.windowMs));
  }

  /** 검사만 수행 (기록 없음) */
  check(key: string, now: number = Date.now()): RateLimitDecision {
    const state = this.states.get(key);
    if (state === undefined) return { allowed: true };
    this.prune(state, now);
    for (const rule of this.rules) {
      const cutoff = now - rule.windowMs;
      const count = state.timestamps.filter((ts) => ts > cutoff).length;
      if (count >= rule.max) {
        const oldestInWindow = state.timestamps.find((ts) => ts > cutoff);
        const retryAfterMs =
          oldestInWindow === undefined ? rule.windowMs : oldestInWindow + rule.windowMs - now;
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }
    }
    return { allowed: true };
  }

  /** 이벤트 기록 (성공한 요청만 기록할지, 시도 자체를 기록할지는 호출부가 결정) */
  record(key: string, now: number = Date.now()): void {
    let state = this.states.get(key);
    if (state === undefined) {
      state = { timestamps: [] };
      this.states.set(key, state);
    }
    state.timestamps.push(now);
    this.prune(state, now);
  }

  /** 검사 + 통과 시 기록 */
  consume(key: string, now: number = Date.now()): RateLimitDecision {
    const decision = this.check(key, now);
    if (decision.allowed) this.record(key, now);
    return decision;
  }

  /** 직전 이벤트로부터 minIntervalMs 이내면 거부 (연속 등록 제한) */
  checkMinInterval(key: string, minIntervalMs: number, now: number = Date.now()): RateLimitDecision {
    const state = this.states.get(key);
    if (state === undefined || state.timestamps.length === 0) return { allowed: true };
    const last = state.timestamps[state.timestamps.length - 1];
    if (last === undefined) return { allowed: true };
    const elapsed = now - last;
    if (elapsed < minIntervalMs) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((minIntervalMs - elapsed) / 1000)) };
    }
    return { allowed: true };
  }

  private prune(state: KeyState, now: number): void {
    const cutoff = now - this.longestWindowMs;
    while (state.timestamps.length > 0) {
      const first = state.timestamps[0];
      if (first === undefined || first > cutoff) break;
      state.timestamps.shift();
    }
  }

  /** 만료 키 정리 (주기 호출용 — 메모리 누수 방지) */
  sweep(now: number = Date.now()): void {
    for (const [key, state] of this.states) {
      this.prune(state, now);
      if (state.timestamps.length === 0) this.states.delete(key);
    }
  }
}
