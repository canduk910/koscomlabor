import Image from "next/image";
import { WarningIcon } from "@/components/ui/icons";

/**
 * QR 출석체크 안내 (디자인 스펙 §20.19 · 검증 5회차 요구 12~22).
 *
 * 원문: 주최측 배포 `QR 출석체크 안내` 이미지(`design/QR.png` → `public/images/…/qr-guide.png`).
 *
 * **텍스트가 본체이고 이미지는 보조다**(요구 12 · §0.4). 핵심 정보 5건이 전부 아래 텍스트에
 * 있으므로 **이미지를 지워도 정보 손실이 0**이다 — 이미지 안 텍스트는 스크린리더가 못 읽고
 * 확대하면 깨진다.
 *
 * **창작 금지 3종** — 어느 하나라도 넣으면 조합원이 현장에서 출석에 실패한다:
 *  1. **OS·기기별 위치서비스 설정 경로**(`설정 > 개인정보 보호 > …`) — 기기·OS 버전마다 다르다
 *  2. `크롬은 안 됩니다` / `크롬도 됩니다` — **양방향 모두.** 원문이 가부를 쓰지 않았다
 *  3. `2회 미완료 시 출석 무효` · `20:00까지 오시면 됩니다` · `폐회 후 출석`
 * 그리고 `위치서비스를 켜도 노조가 위치를 수집하지 않습니다` 류 안심 문구도 금지다(수집 범위 미확인).
 *
 * **색 강조는 출석 시각 2개에만**(요구 13). 원문의 유일한 색 강조가 형광펜이며,
 * 다른 항목까지 칠하면 **원문의 강조가 번져 위계가 평평해진다.**
 * 노랑을 쓰지 않는 이유: 팔레트에 노랑이 없고 흰 배경에서 대비를 만들지 못한다(§0.3).
 * 형광펜의 기능은 "면을 칠해 눈에 띄게"이므로 `bg-primary-soft` 면이 그 기능의 정확한 대응이다.
 *
 * **운영 = 확정 / 배포 = 예정**을 뒤섞지 않는다: 출석 절차는 확정 사실이지만 QR 손피켓 배포는
 * 여전히 "예정"이라, 그 문장만 **카드 밖 이미지 캡션 자리**에 둔다(요구 20).
 */

/** 원본 파일 규격 — `width`/`height` 로 CLS 0 */
const QR_IMAGE = {
  src: "/images/rally-2026-08-28/qr-guide.png",
  width: 1920,
  height: 1080,
  /** 검증 §5-4 제시 문자열 그대로. **`alt=""` 로 두지 마라** — 요약이며 대체 본문은 위 텍스트다 */
  alt: "주최측 배포 “QR 출석체크 안내” 원본 이미지 — 같은 내용이 위 텍스트에 있습니다",
} as const;

/** 출석 2회 — 이 카드 안에서 유일한 대형 타이포이자 유일한 채색 면 */
const ATTENDANCE_SLOTS = [
  { label: "1차 출석", time: "18:30 ~ 19:30", spoken: "오후 6시 30분부터 7시 30분까지" },
  { label: "2차 출석", time: "20:00 ~ 21:00", spoken: "오후 8시부터 9시까지" },
] as const;

export function QrAttendanceCard() {
  return (
    <>
      <div className="rounded-panel shadow-card mt-6 bg-bg p-5 md:p-6">
        {/* ① 출발 전 확인 — 위치서비스 동의는 **집을 나서기 전에 하는 유일한 준비물**이다.
            현장에서 처음 알면 늦으므로 카드 맨 앞에 온다(검증 §5-3 · §5-10) */}
        <p className="text-lead text-ink">출발 전 확인</p>
        <p className="mt-2 break-keep text-body text-ink">
          아이폰 SAFARI · 갤럭시 인터넷에서 위치서비스 이용 동의 설정
        </p>
        {/* `※` 두 줄을 흐리지 마라 — 보조 텍스트가 아니라 행동 지시다 */}
        <p className="mt-2 break-keep text-caption text-ink">
          ※ 안내자료에 명시된 브라우저입니다. 위치 접근 요청이 표시되면 동의해 주세요.
        </p>
        <p className="mt-1 break-keep text-caption text-ink">
          ※ 현장에서 설정하려면 늦습니다. 출발 전에 확인해 주세요.
        </p>

        {/* ② 출석 2회 — 이 블록의 유일한 색 강조 */}
        <p className="mt-8 text-lead text-ink">출석체크는 총 2회 진행됩니다</p>
        {/*
          `overflow-x-auto`: 텍스트 확대 200% 에서 시각(24→48px)이 면 안쪽 폭을 넘는다(§20.19.9).
          `whitespace-nowrap` 은 **유지 필수** — 시각이 두 줄로 끊기면 판독이 무너진다.
          그래서 줄바꿈이 아니라 면 안쪽 스크롤로 흡수한다.
        */}
        <dl className="rounded-card bg-primary-soft mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 overflow-x-auto p-4">
          {ATTENDANCE_SLOTS.map((slot) => (
            <div key={slot.label} className="contents">
              <dt className="text-caption font-semibold text-primary">{slot.label}</dt>
              {/*
                `relative` 가 없으면 안 된다 — `sr-only` 는 `position:absolute` 이고, 위치
                기준(containing block)이 없으면 **스크롤 컨테이너를 빠져나가** 문서 가로
                스크롤을 만든다. 텍스트 확대 200% 에서 실측 135px 이 새 나갔다.
              */}
              <dd className="font-display relative text-h2 whitespace-nowrap text-primary">
                {/* 구간이라 `<time>` 을 쓰지 않는다 — 같은 시각의 한국어 장형 병기(§20.19.7) */}
                <span aria-hidden="true">{slot.time}</span>
                <span className="sr-only">{slot.spoken}</span>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 break-keep text-body text-ink">※ 두 시간대 모두 확인해 주세요.</p>
        {/* **이 문장을 생략하지 마라**(요구 15). 원문 두 사실(2차 20:00~21:00 · 폐회 20:20~)의
            병치이며 "폐회했으니 간다"는 오독을 막는 유일한 수단이다 */}
        <p className="mt-2 break-keep text-body text-ink">
          ※ 2차 출석 시간은 식순상 폐회(20:20~)보다 늦게까지 열려 있습니다. 폐회 후라도 2차 출석을
          아직 하지 않았다면 21:00 전에 완료해 주세요.
        </p>

        {/* ③ 인증 제한 — 원문 `한개`·`한명` 은 맞춤법 교정 게시 무방(검증 §5-10 명시) */}
        <p className="mt-8 text-lead text-ink">인증 제한</p>
        <p className="mt-2 break-keep text-body text-ink">
          한 개의 휴대폰으로 한 명만 인증할 수 있습니다.
        </p>

        {/*
          ④ 등록하지 못한 경우 — 카드 하단 고정(원문에서도 마지막).
          **적색을 쓰지 마라.** 이것은 실패 대비 안내이지 긴급 정보가 아니다. 적색을 쓰면
          이 페이지 유일한 적색이 되어 집결 시각보다 강해지고, §16 의 적색 의미(긴급·마감·쟁의)도
          오염된다. `role="alert"` 도 주지 마라 — 정적 콘텐츠이며 alert 는 동적 알림용이다.
        */}
        <div className="rounded-card border border-border-strong mt-8 flex gap-3 p-4">
          <WarningIcon className="size-5 shrink-0 text-ink-muted" />
          <div className="min-w-0">
            <p className="text-body font-bold text-ink">등록하지 못한 경우</p>
            <p className="mt-2 break-keep break-words text-body text-ink">
              휴대폰 GPS 설정 오류, 기타 오류 등으로 등록하지 못한 경우 현장 인증샷 대체 혹은 각 지부
              수기접수를 요청해 주세요.
            </p>
          </div>
        </div>
      </div>

      {/*
        원본 이미지 — **보조**다. 표시 폭 480px 상한: 스캔 대상이 아니므로 크게 낼 이유가 없다.

        ⚠ **`unoptimized` 를 지우지 마라 (리더 승인 2026-08-18).**
        Next 이미지 최적화는 기본이 **WebP 손실 압축**이다. 원본 QR 은 모듈당 3px 경계선이라
        (검증 §5-4) 재인코딩이 들어가면 **판독 가능성이 더 나빠진다.** `next/image` 를 쓰는 목적은
        **CLS 방지와 크기 지정**(`width`/`height`)이지 재인코딩이 아니다 — 스펙 §20.19.4 의
        `unoptimized` 의도와 같다. "왜 최적화를 껐지"라고 되돌리지 말 것.
        **스캔 유도 문구도, 스캔 금지 문구도 넣지 마라** — 전자는 해상도·대상 URL 미확인이라
        위험하고, 후자는 원문에 없는 제약이라 현장의 조합원을 불필요하게 막는다.
        라이트박스·모달을 만들지 마라 — §0.4 은폐 패턴에 인접하고 브라우저 확대로 충분하다.
      */}
      <figure className="mt-5">
        <Image
          src={QR_IMAGE.src}
          width={QR_IMAGE.width}
          height={QR_IMAGE.height}
          alt={QR_IMAGE.alt}
          unoptimized
          className="rounded-badge border border-border-soft block h-auto w-full max-w-[480px]"
        />
        <figcaption className="mt-3 text-caption text-ink">주최측 배포 안내자료</figcaption>
        {/* 출석 **운영은 확정**, QR 의 **배포는 예정**. 두 확정도를 뒤섞지 않도록 카드 밖에 둔다 */}
        <p className="mt-2 break-keep text-caption text-ink">
          ※ 출석 QR은 손피켓에 넣어 배포할 예정입니다. (주최측 안내자료 기준)
        </p>
      </figure>
    </>
  );
}
