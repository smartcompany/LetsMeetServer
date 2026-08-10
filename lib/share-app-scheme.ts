/** LetsMeet 앱 커스텀 스킴 (client DeepLinkHandler 와 동일) */
export const LETSMEET_APP_SCHEME = 'letsmeet';

export function buildMeetingAppSchemeUrl(meetingId: string): string {
  return `${LETSMEET_APP_SCHEME}://meeting/${encodeURIComponent(meetingId)}`;
}

/**
 * 모임 공유 랜딩 (/meeting/{id})
 * - PC/Mac: lime 웹으로 이동
 * - 모바일: "앱에서 열기"만 표시 (웹·다운로드 버튼 숨김)
 * - X/카카오 등 인앱: 자동 스킴 시도 없음 → 버튼 탭 시 앱 / 미설치 시 /applink(스토어)
 * - Safari·Chrome 모바일: 진입 시 자동 스킴 시도 → 실패 시 스토어
 */
export function buildMeetingLandingScript(
  meetingId: string,
  downloadUrl: string,
  webMeetingUrl: string,
): string {
  const appSchemeUrl = buildMeetingAppSchemeUrl(meetingId);
  const inAppReSource = String.raw`/(Twitter|X\/[\d.]+|FBIOS|FBAN|FBAV|Line\/|KakaoTalk|Kakao|Daum|KAKAOTALK|Whatsapp|Telegram|Snapchat|Slack|LinkedIn|FB_IAB|Instagram|Pinterest|musical_ly|ByteDance|Aweme|; wv\))/i`;

  return `
(function () {
  var appScheme = ${JSON.stringify(appSchemeUrl)};
  var downloadUrl = ${JSON.stringify(downloadUrl)};
  var webMeetingUrl = ${JSON.stringify(webMeetingUrl)};
  var inAppRe = ${inAppReSource};
  var ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  var isMobile = /android|iphone|ipad|ipod/i.test(ua);
  var inApp = inAppRe.test(ua);

  function $(id) {
    return document.getElementById(id);
  }

  function hide(el) {
    if (el) el.style.display = "none";
  }

  function showBlock(el) {
    if (el) {
      el.style.display = "inline-block";
    }
  }

  function tryOpenAppThenStore(onComplete) {
    var switchedToApp = false;
    function onHidden() {
      if (document.visibilityState === "hidden") {
        switchedToApp = true;
      }
    }
    document.addEventListener("visibilitychange", onHidden, { passive: true });
    window.addEventListener("pagehide", onHidden, { passive: true });

    var iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = appScheme;
    document.body.appendChild(iframe);

    window.setTimeout(function () {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      if (!switchedToApp) {
        window.location.href = downloadUrl;
      }
      if (onComplete) onComplete();
    }, 1500);
  }

  function applyUi() {
    var hint = $("meeting-hint");
    var btnWeb = $("meeting-btn-web");
    var btnApp = $("meeting-btn-app");
    var btnDownload = $("meeting-btn-download");

    if (!isMobile) {
      hide(btnWeb);
      hide(btnApp);
      hide(btnDownload);
      if (hint) {
        hint.textContent = "웹 앱으로 이동 중입니다…";
      }
      return;
    }

    hide(btnWeb);
    hide(btnDownload);
    showBlock(btnApp);
    if (hint) {
      hint.textContent = inApp
        ? "아래 버튼을 눌러 이음터 앱에서 모임을 확인하세요. 앱이 없으면 설치 페이지로 이동합니다."
        : "앱이 있으면 자동으로 열립니다. 열리지 않으면 아래 버튼을 눌러 주세요.";
    }

    if (btnApp) {
      btnApp.addEventListener("click", function (e) {
        e.preventDefault();
        tryOpenAppThenStore();
      });
    }
  }

  function run() {
    applyUi();

    if (!isMobile) {
      window.location.replace(webMeetingUrl);
      return;
    }

    if (inApp) {
      return;
    }

    tryOpenAppThenStore();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
`.trim();
}
