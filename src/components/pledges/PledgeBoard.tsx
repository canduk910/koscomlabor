"use client";

import { useState } from "react";
import type { ApiPledge, PledgeStatus } from "@/lib/api/pledges";
import {
  PLEDGE_CATEGORY_LABELS,
  PLEDGE_CATEGORY_ORDER,
  PLEDGE_HIGHLIGHT_LABEL,
  PLEDGE_STATUS_META,
  PLEDGE_STATUS_ORDER,
  tallyPledges,
} from "@/lib/pledges";
import { PledgeProgress } from "@/components/pledges/PledgeProgress";
import { PledgeStatusBadge } from "@/components/pledges/PledgeStatusBadge";

type Filter = "all" | PledgeStatus;

/** 공약 카드 한 장. 세부 항목은 원문의 줄바꿈이 곧 항목 구분이라 목록으로 편다 */
function PledgeCard({ pledge }: { pledge: ApiPledge }) {
  const lines = pledge.detail === null ? [] : pledge.detail.split("\n");
  return (
    <li className="rounded-card shadow-card bg-bg p-5">
      {/* ⚠ 모바일 1열 · md 부터만 가로 — 좁은 폭에서 배지와 제목이 같은 행을 다투면
          200% 확대에서 제목 트랙이 내용 폭을 그대로 잡는다(§0.8.1) */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4">
        {/* 제목은 블록이고 「핵심」 배지는 그 안을 흐르는 인라인이다 — 배지가 제목의 첫 낱말처럼
            함께 줄바꿈된다. ⚠ 배지의 `align-middle` 을 빼지 마라(기준선에 앉으면 줄 높이가 튄다).
            ⚠ **이 구조는 가로 넘침의 해법이 «아니다»** — 그 처방은 아래 `ul` 의 `grid-cols-1` 이다.
              (`overflow-wrap: break-word` 는 min-content 기여값을 줄이지 않는다 — 실측으로 확인했다.
               제목을 블록으로 바꿔도 min-content 는 217.8px 그대로였다.) */}
        <h3 className="min-w-0 break-keep break-words text-body font-bold text-ink md:text-lead">
          {pledge.highlight ? (
            <span className="rounded-badge mr-2 inline-block bg-primary-soft px-2 py-0.5 align-middle text-caption font-bold text-primary">
              {PLEDGE_HIGHLIGHT_LABEL}
            </span>
          ) : null}
          {pledge.title}
        </h3>
        <PledgeStatusBadge status={pledge.status} className="self-start md:mt-0.5" />
      </div>

      {lines.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {lines.map((line, index) => (
            <li
              // 원문에 같은 줄이 두 번 나올 수 있어 문자열만으로는 key 가 겹친다
              key={`${index}-${line}`}
              className="flex gap-2 break-keep break-words text-caption text-ink-muted"
            >
              <span aria-hidden="true" className="select-none">
                ·
              </span>
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {pledge.note !== null ? (
        <p className="rounded-badge mt-4 bg-surface p-3 text-caption text-ink">
          <b className="font-bold">비고</b>{" "}
          <span className="break-keep break-words whitespace-pre-line">{pledge.note}</span>
        </p>
      ) : null}
    </li>
  );
}

/**
 * 공약 이행 현황 전체보기 — 요약 + 상태 필터 + 카테고리 4개 섹션.
 *
 * ★★ **필터에 «선택됨» 표시를 «두는» 것이 맞다 — union-design-system §0.4 와 헷갈리지 마라.**
 *   §0.4 가 하이라이트를 금지한 것은 «바로가기 칩»(앵커)이다. 그것은 아무것도 숨기지 않는데
 *   선택 표시가 있으면 «나머지는 안 보임»으로 오독되기 때문이었다.
 *   **여기 필터는 실제로 숨긴다.** 무엇이 켜져 있는지 안 보이면 조합원은 «공약이 12건뿐»
 *   이라고 읽는다 — 그쪽이 훨씬 나쁜 오독이다.
 *   대신 §0.4 가 요구하는 완화를 전부 건다: **기본값은 「전체」 · 각 선택지에 건수 표기 ·
 *   결과 0건이면 «없다»고 말한다.** ⛔ 이 셋 중 하나라도 빼지 마라.
 */
export function PledgeBoard({ pledges }: { pledges: ApiPledge[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const tally = tallyPledges(pledges.map((pledge) => pledge.status));

  const counts: Record<Filter, number> = {
    all: tally.total,
    done: tally.done,
    talking: tally.talking,
    undone: tally.undone,
  };
  const visible = filter === "all" ? pledges : pledges.filter((p) => p.status === filter);

  const options: { value: Filter; label: string }[] = [
    { value: "all", label: "전체" },
    ...PLEDGE_STATUS_ORDER.map((status) => ({
      value: status as Filter,
      label: PLEDGE_STATUS_META[status].label,
    })),
  ];

  return (
    <>
      <section
        aria-labelledby="pledge-summary-title"
        className="rounded-panel shadow-card mt-8 bg-bg p-5 md:p-6"
      >
        <h2 id="pledge-summary-title" className="text-h2 text-ink">
          전체 이행 현황
        </h2>
        <p className="mt-1 text-caption text-ink-muted">
          공약 <b className="font-bold tabular-nums text-ink">{tally.total}</b>건 중{" "}
          <b className="font-bold tabular-nums text-ink">{tally.done}</b>건 달성
        </p>
        <PledgeProgress tally={tally} className="mt-4" />
      </section>

      <div className="mt-8">
        {/* ⚠ **`h2` 로 되돌리지 마라.** 이 줄은 caption 크기라 아래 카드 제목(`h3`)보다 «작다» —
            제목으로 만들면 위계가 시각적으로 뒤집힌다. 그리고 이 글자가 이미 묶음의 이름이므로
            `aria-labelledby` 로 가리키면 된다(`aria-label` 을 따로 적으면 문면이 두 벌이 된다). */}
        <p id="pledge-filter-label" className="text-caption font-bold text-ink">
          상태로 보기
        </p>
        <div
          role="group"
          aria-labelledby="pledge-filter-label"
          className="mt-2 flex flex-wrap gap-2"
        >
          {options.map((option) => {
            const active = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.value)}
                className={`rounded-full min-h-touch px-4 text-caption font-semibold transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                  active
                    ? "bg-primary text-white"
                    : "border border-border-strong bg-bg text-ink hover:bg-primary-tint"
                }`}
              >
                {option.label}
                <span className="ml-1.5 tabular-nums">{counts[option.value]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-card mt-6 bg-surface px-4 py-12 text-center text-body text-ink">
          해당 상태인 공약이 없습니다.
        </p>
      ) : (
        PLEDGE_CATEGORY_ORDER.map((category) => {
          const rows = visible.filter((pledge) => pledge.category === category);
          if (rows.length === 0) return null;
          return (
            <section
              key={category}
              aria-labelledby={`pledge-cat-${category}`}
              className="mt-10 md:mt-14"
            >
              <h2
                id={`pledge-cat-${category}`}
                className="flex flex-wrap items-baseline gap-x-3 text-h2 text-ink"
              >
                {PLEDGE_CATEGORY_LABELS[category]}
                <span className="text-caption font-normal text-ink-muted tabular-nums">
                  {rows.length}건
                </span>
              </h2>
              {/*
                ★★ **`grid-cols-1` 을 지우지 마라 — 그것이 가로 넘침의 처방이다.**
                `grid md:grid-cols-2` 만 쓰면 모바일에서 `grid-template-columns` 가 «없어»
                암시적 트랙이 `auto` 가 되고, **트랙 폭이 카드의 min-content 로 잡힌다.**
                Tailwind 의 `grid-cols-N` 은 `repeat(N, minmax(0,1fr))` 이라 그 최소를 0 으로 끊는다
                (union-design-system §0.8.1 의 «트랙 최소 폭을 내용에서 끊는다» 처방).
                > 실측(320 뷰포트 · 스크롤바 15 · clientWidth 305 · 루트 32px = 이 저장소의 「200%」):
                >   `grid-cols-1` 없음 → 카드 min-content **297.8px** vs 트랙 예산 241px
                >   → **문서 가로 스크롤 24.8px**. `grid-cols-1` 을 넣으면 **0**.
                ⚠ 글자 처방(`break-keep break-words`)을 고쳐서 풀려고 하지 마라 —
                  `overflow-wrap: break-word` 는 **min-content 기여값을 줄이지 않는다.**
              */}
              <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {rows.map((pledge) => (
                  <PledgeCard key={pledge.id} pledge={pledge} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
