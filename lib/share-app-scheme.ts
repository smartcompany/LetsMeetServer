/** LetsMeet 앱 커스텀 스킴 (client DeepLinkHandler 와 동일) */
export const LETSMEET_APP_SCHEME = 'letsmeet';

export function buildMeetingAppSchemeUrl(meetingId: string): string {
  return `${LETSMEET_APP_SCHEME}://meeting/${encodeURIComponent(meetingId)}`;
}

/**
 * 모바일: iframe 으로 앱 스킴 시도 → 실패 시 /applink (UA별 스토어 302)
 * 데스크톱(Mac/PC): Flutter 웹(lets-meet-lime) 모임 페이지로 이동
 */
export function buildMeetingLandingScript(
  meetingId: string,
  downloadUrl: string,
  webMeetingUrl: string,
): string {
  const appSchemeUrl = buildMeetingAppSchemeUrl(meetingId);
  return `
(function () {
  function run() {
    var appScheme = ${JSON.stringify(appSchemeUrl)};
    var downloadUrl = ${JSON.stringify(downloadUrl)};
    var webMeetingUrl = ${JSON.stringify(webMeetingUrl)};
    var ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    var isMobile = /android|iphone|ipad|ipod/i.test(ua);
    var switchedToApp = false;

    function onHidden() {
      if (document.visibilityState === "hidden") {
        switchedToApp = true;
      }
    }

    function redirectToDownload() {
      if (switchedToApp) { return; }
      window.location.replace(downloadUrl);
    }

    // Mac/PC → 웹 앱
    if (!isMobile) {
      window.location.replace(webMeetingUrl);
      return;
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
      redirectToDownload();
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
`.trim();
}
