import Image from "next/image";

import { ExternalLinkIcon } from "@/components/ui/icons";
import { EXTERNAL_LINKS, UNION_ATTENDANCE_DISPLAY_HOST } from "@/lib/routes";

/**
 * QR 출석체크 안내 — **주최측 원본 이미지 + 이미지에 없는 것만 문자로**.
 *
 * ★★ **중복 제거**(사용자 지시 2026-08-22 — *"그림과 제목/컨텐츠가 중복돼. 불필요한 중복컨텐츠는 삭제하자"*).
 *
 * 종전에는 이미지가 말하는 것을 **네 블록 전부 문자로 다시 적었다**:
 *   `출발 전 확인`(위치서비스) · `출석체크는 총 2회`(+시간표) · `인증 제한` · `등록하지 못한 경우`
 * 넷 다 **이미지 안에 그대로 있다.** 조합원은 같은 안내를 두 번 읽어야 했다.
 *
 * ⚠ **되살리기 전에 읽어라 — 지운 것은 «그림이 이미 말하는 것» 뿐이다.**
 * 아래 세 줄은 **이미지에 없어서 남겼다.** 지우면 정보가 사라진다:
 *   1. 손피켓 배포 — 주최측 캡션 원문(이미지 본문에는 없다)
 *   2. 위치 접근 요청 동의 — 실제로 눌러야 하는 행동
 *   3. **폐회 후 2차 출석** — 식순 대조로만 나오는 사실이고 **행동이 갈린다**
 *      (폐회하면 끝난 줄 알고 귀가하면 2차 출석을 놓친다)
 *
 * ⚠ **`alt` 가 이제 이미지의 **완전한 텍스트 등가**다.** 종전 `alt` 는
 * *"같은 내용을 이 카드에 텍스트로 적었습니다"* 라고 **카드를 가리켰는데, 그 카드가 사라졌다** —
 * 그대로 뒀으면 스크린리더 사용자를 없는 곳으로 보내고 시간표를 통째로 잃는다.
 * **`alt` 를 짧게 줄이지 마라.**
 */
const QR_IMAGE = {
  src: "/images/rally-2026-08-28/qr-guide.png",
  width: 1920,
  height: 1080,
  alt:
    "주최측 배포 “QR 출석체크 안내”. " +
    "참석확인은 총 2회 진행합니다 — 1차 출석 오후 6시 30분부터 7시 30분까지, " +
    "2차 출석 오후 8시부터 9시까지. " +
    "아이폰 SAFARI, 갤럭시 인터넷에서 위치서비스 이용 동의를 설정해 주세요. " +
    "한 개의 휴대폰으로 한 명만 인증할 수 있습니다. " +
    "휴대폰 GPS 설정 오류, 기타 오류 등으로 등록하지 못한 경우 현장 인증샷 대체 혹은 " +
    "각 지부 수기접수를 요청해 주세요.",
} as const;

export function QrAttendanceCard() {
  return (
    <figure className="mt-6">
      <Image
        src={QR_IMAGE.src}
        width={QR_IMAGE.width}
        height={QR_IMAGE.height}
        alt={QR_IMAGE.alt}
        unoptimized
        className="rounded-badge border border-border-soft block h-auto w-full max-w-[480px]"
      />
      <figcaption className="mt-3 text-caption text-ink">주최측 배포 안내자료</figcaption>

      {/* 이미지에 **없는** 것만. 순서는 조합원이 하는 순서다 — 받는다 → 켠다 → 끝나도 남는다 */}
      <p className="mt-3 break-keep text-caption text-ink">
        ※ 출석 QR은 손피켓에 넣어 배포합니다. (주최측 안내자료 기준)
      </p>
      <p className="mt-2 break-keep text-caption text-ink">
        ※ 위치 접근 요청이 표시되면 동의해 주세요.
      </p>

      {/*
        ★ **이것만 `※` 가 아니라 면을 가진 블록이다.** 나머지 둘과 무게가 다르다 —
        폐회하면 끝난 줄 알고 귀가하면 **2차 출석을 놓친다.** 행동이 갈리는 유일한 줄이라
        `※` 더미에 섞지 않는다(§5.3 — 단서는 개수를 세고, 무게가 다른 것은 형태로 가른다).
      */}
      <p className="rounded-card bg-primary-soft mt-4 break-keep p-4 text-body text-ink">
        2차 출석 시간은 식순상 폐회(20:20~)보다 늦게까지 열려 있습니다. 폐회 후라도 2차 출석을 아직
        하지 않았다면 21:00 전에 완료해 주세요.
      </p>

      {/*
        ★ **출석체크 페이지 바로 가기**(사용자 지시 2026-08-25 · URL 도 사용자가 줬다).
        QR 을 찍지 못하는 상황 — 손피켓을 못 받았거나, 카메라가 QR 을 못 읽거나 —
        에서 **같은 곳으로 가는 두 번째 경로**다. 대상은 QR 이 가리키는 그 페이지가 맞다
        (응답 실측: `<title>금융노조 집회참석</title>`).

        ⚠ **«아웃라인 필 버튼» 모양으로 만들지 마라**(§24.5 · `WayfindingBlock` 과 같은 규칙).
        이 프로젝트에서 **필 버튼은 «우리 페이지 안에서 일어나는 조작»의 형태**이고
        **외부로 나가는 것은 다르게 생겨야 한다.** 그래서 **카드**다 — 누르는 면은 오히려 더 넓고,
        어디로 가는지도 함께 말한다.

        ★ **면을 남색으로 채웠다**(사용자 지시 2026-08-25 — *"조금 더 강조해줘. 남색바탕에 흰색글씨"*).
        **형태는 그대로 카드**이므로 위 규칙과 충돌하지 않는다 — 바뀐 것은 **무게**뿐이다.
        길찾기 카드(흰 면 + 테두리)와 **일부러 다르게** 둔다: 길찾기는 *가는 길*이고
        이것은 **당일 반드시 해야 하는 행동**이라 페이지 안에서 가장 무거운 항목이다.
        대비: 흰 글자 ↔ `#093389` = **12.6**(AAA).

        ⚠ **hover 테두리를 남색으로 두지 마라** — 남색 면 위에서는 보이지 않는다. 안쪽 흰 선이다.
        ⚠ 포커스 링은 **바깥**(`outline-offset-2`)이라 흰 배경 위에 그려진다 — 남색 그대로 둔다.

        외부 이동 **3중 병행**(§14.1): ↗ 아이콘 + 도메인 표기 + 접근성 이름
        (카드 전체가 단일 `<a>` 라 내부 텍스트가 접근성 이름에 자동 포함된다).

        ⚠ **둘째 줄을 지우지 마라.** 8/28 출석 시간 밖에서 누르면 대상 페이지에 **입력 폼이 없고**
        *"지정된 시간에만 체크 가능합니다."* 한 줄만 나온다(실측). 이 문장이 없으면
        조합원이 **«링크가 고장났다»** 로 읽고 다른 경로를 찾아 헤맨다 — 행동이 갈린다(§5.3).
        시간표 자체는 위 이미지가 이미 말하므로 **여기에 다시 적지 않는다.**
      */}
      <a
        href={EXTERNAL_LINKS.unionAttendance}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-card shadow-card ease-out-soft group mt-4 block bg-primary p-4 transition-opacity duration-150 hover:opacity-95 hover:outline-2 hover:-outline-offset-4 hover:outline-white focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <span className="block break-keep text-lead font-bold text-white group-hover:underline">
          QR 인증 바로 하기
          <ExternalLinkIcon className="ml-1 inline size-5 align-[-3px]" />
        </span>
        <span className="mt-1 block break-keep text-caption text-white">
          주최측 출석체크 페이지입니다. 지정된 출석 시간에만 체크됩니다.
        </span>
        {/* 도메인 줄만 한 단계 낮춘다 — **흐리게가 아니라 «덜 굵게»** 다.
            `white/80` 대비는 남색 위에서 여전히 8 이상이라 읽는 데 지장이 없다 */}
        <span className="mt-1.5 block text-caption text-white/80">
          외부 링크(새 창) · {UNION_ATTENDANCE_DISPLAY_HOST}
        </span>
      </a>
    </figure>
  );
}
