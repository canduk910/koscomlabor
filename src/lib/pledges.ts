import type { PledgeCategory, PledgeStatus } from "@/lib/api/pledges";

/**
 * 공약 상황판의 **화면 문면·순서 단일 출처**.
 *
 * 서버는 코드(`strong`·`done` …)만 알고 한국어를 모른다. 라벨이 화면 쪽에 모여 있어야
 * 문면을 고칠 때 서버 재배포가 필요 없고(§API 는 CD 제외 — 수동 배포다), 라벨과 순서가
 * 한 파일에 있으므로 «순서만 바뀌고 라벨은 안 바뀌는» 어긋남이 생기지 않는다.
 * `POST_CATEGORY_LABELS`(게시물)와 같은 형태다 — 그쪽 주석에 이 방식의 사고 이력이 있다.
 */

/** 카테고리 라벨 — 공약집이 스스로 붙인 표제 그대로. ⛔ 다듬지 마라 */
export const PLEDGE_CATEGORY_LABELS: Record<PledgeCategory, string> = {
  strong: "든든한 코스콤",
  happy: "행복한 코스콤",
  fair: "공정한 코스콤",
  dream: "꿈꾸는 코스콤",
};

/**
 * 카테고리 화면 순서 = 공약집 2쪽 배치 순서(왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래).
 * ★ **서버는 카테고리 «간» 순서를 모른다**(SQL 의 category 는 알파벳순이라 무관하다).
 *   여기가 유일한 출처다 — `repos/pledges.ts` 머리 주석과 짝을 이룬다.
 */
export const PLEDGE_CATEGORY_ORDER = [
  "strong",
  "happy",
  "fair",
  "dream",
] as const satisfies readonly PledgeCategory[];

/**
 * 신호등 3단계의 화면 표현.
 *
 * ★ **색만으로 뜻을 전하지 않는다**(union-design-system §2 — 색각이상 조합원 대응):
 *   `label`(글자) + `mark`(기호) + 색, 셋을 **항상 함께** 쓴다.
 *   ⛔ 공간이 좁다고 기호나 글자를 떼지 마라 — 그 순간 색 하나만 남는다.
 * ★ 라벨 문면은 사용자가 확정했다(2026-09-06). **한 글자도 바꾸지 마라.**
 *
 * 배열 순서 = 화면에 세우는 순서(달성 → 협의중 → 미달성). 진행률 막대 조각 순서도 이것이다.
 */
export const PLEDGE_STATUS_ORDER = ["done", "talking", "undone"] as const satisfies readonly PledgeStatus[];

export interface PledgeStatusMeta {
  label: string;
  /** 색 없이도 세 상태가 구분되는 기호 (색각이상·흑백 인쇄 대응) */
  mark: string;
  /** 배지: 바탕 + 글자 (전부 AAA — globals.css 신호등 주석에 실측치) */
  badgeClass: string;
  /** 표식 점·진행 막대 조각의 바탕색 */
  dotClass: string;
}

export const PLEDGE_STATUS_META: Record<PledgeStatus, PledgeStatusMeta> = {
  done: {
    label: "달성",
    mark: "●",
    badgeClass: "bg-done-tint text-done-strong",
    dotClass: "bg-done",
  },
  talking: {
    label: "협의중",
    mark: "◐",
    badgeClass: "bg-talking-tint text-talking-strong",
    dotClass: "bg-talking",
  },
  // 적색은 기존 urgent 토큰 재사용 — 신규 색을 늘리지 않기 위해서다(globals.css 주석)
  undone: {
    label: "미달성",
    mark: "○",
    badgeClass: "bg-urgent-tint text-urgent-strong",
    dotClass: "bg-urgent",
  },
};

/** 공약집 2쪽 「핵심공약」 표시의 라벨. ⛔ 다른 문면을 쓰지 마라 */
export const PLEDGE_HIGHLIGHT_LABEL = "핵심";

export interface PledgeTally {
  done: number;
  talking: number;
  undone: number;
  total: number;
  /** 달성 비율(%) 정수. 전체 0건이면 0 */
  donePercent: number;
}

/**
 * 상태 집계.
 *
 * ⚠ `donePercent` 는 **`Math.round` 가 아니라 «달성 0 건이면 반드시 0»** 이 되게 한다 —
 *   반올림만 쓰면 43건 중 0건에서 0% 로 맞지만, 반대로 **전부 달성인데 99%** 같은 값이
 *   나오지 않게 상한도 함께 못박는다. 진행률은 조합원이 «다 됐나»를 읽는 숫자다.
 */
export function tallyPledges(statuses: readonly PledgeStatus[]): PledgeTally {
  const done = statuses.filter((s) => s === "done").length;
  const talking = statuses.filter((s) => s === "talking").length;
  const undone = statuses.filter((s) => s === "undone").length;
  const total = statuses.length;
  let donePercent = 0;
  if (total > 0) {
    if (done === total) donePercent = 100;
    else if (done > 0) donePercent = Math.max(1, Math.round((done / total) * 100));
  }
  return { done, talking, undone, total, donePercent };
}
