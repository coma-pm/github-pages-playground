(function () {
  const MEASUREMENT_ID = "G-P6HSYY8Z3X";
  const USER_KEY = "signal-studio.user-id";
  const PROFILE_KEY = "signal-studio.profile";
  const sessionId = createSessionId();
  const userId = readOrCreate(USER_KEY, createUserId);
  const state = {
    pageType: "unknown",
    contentGroup: "general",
    toolName: "none",
    scrollMarks: new Set(),
    interactionMarks: new Set()
  };

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  window.gtag = window.gtag || gtag;
  loadGtag();
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
    user_id: userId,
    anonymize_ip: true
  });

  applyStoredProfile();

  function loadGtag() {
    if (document.querySelector('script[data-gtag-loader="true"]')) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
    script.dataset.gtagLoader = "true";
    document.head.append(script);
  }

  function createUserId() {
    return "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function createSessionId() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function readOrCreate(key, factory) {
    try {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const value = factory();
      localStorage.setItem(key, value);
      return value;
    } catch (error) {
      return factory();
    }
  }

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function applyStoredProfile() {
    const profile = readProfile();
    if (!Object.keys(profile).length) return;
    window.gtag("set", "user_properties", sanitizeParams(profile));
  }

  function sanitizeValue(value) {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value).slice(0, 100);
  }

  function sanitizeParams(params) {
    return Object.fromEntries(
      Object.entries(params)
        .map(([key, value]) => [key, sanitizeValue(value)])
        .filter(([, value]) => value !== undefined)
    );
  }

  function track(eventName, params) {
    window.gtag("event", eventName, sanitizeParams({
      ...params,
      page_type: state.pageType,
      content_group: state.contentGroup,
      tool_name: state.toolName,
      session_id: sessionId
    }));
  }

  function initPage(options) {
    state.pageType = options.pageType || state.pageType;
    state.contentGroup = options.contentGroup || state.contentGroup;
    state.toolName = options.toolName || state.toolName;

    track("page_view", {
      page_title: document.title,
      page_path: location.pathname,
      page_location: location.href
    });

    bindTrackElements();
    bindOutboundLinks();
    bindScrollDepth();
  }

  function bindTrackElements() {
    document.querySelectorAll("[data-track-event]").forEach((element) => {
      element.addEventListener("click", () => {
        const params = {};
        Object.entries(element.dataset).forEach(([key, value]) => {
          if (!key.startsWith("trackParam")) return;
          const paramName = key.slice("trackParam".length);
          if (!paramName) return;
          const normalized = paramName.charAt(0).toLowerCase() + paramName.slice(1);
          params[normalized] = value;
        });

        if (element.dataset.trackLabel) params.label = element.dataset.trackLabel;
        if (element.dataset.trackDestination) params.destination = element.dataset.trackDestination;
        track(element.dataset.trackEvent, params);
      });
    });
  }

  function bindOutboundLinks() {
    document.querySelectorAll('a[href^="http"]').forEach((link) => {
      link.addEventListener("click", () => {
        try {
          const url = new URL(link.href);
          if (url.host === location.host) return;
          track("outbound_click", {
            destination_host: url.host,
            destination_path: url.pathname,
            label: link.textContent.trim().slice(0, 80)
          });
        } catch (error) {
          return;
        }
      });
    });
  }

  function bindScrollDepth() {
    const marks = [25, 50, 75, 90];
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percent = Math.round((window.scrollY / scrollable) * 100);

      marks.forEach((mark) => {
        if (percent >= mark && !state.scrollMarks.has(mark)) {
          state.scrollMarks.add(mark);
          track("scroll_milestone", { milestone_percent: mark });
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function setProfile(profile) {
    const nextProfile = { ...readProfile(), ...profile };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    } catch (error) {
      return;
    }
    window.gtag("set", "user_properties", sanitizeParams(nextProfile));
  }

  function trackOnce(mark, eventName, params) {
    if (state.interactionMarks.has(mark)) return;
    state.interactionMarks.add(mark);
    track(eventName, params);
  }

  async function copyText(text, params) {
    await navigator.clipboard.writeText(text);
    track("copy_result", params);
  }

  window.SiteAnalytics = {
    initPage,
    track,
    setProfile,
    readProfile,
    trackOnce,
    copyText,
    userId
  };
})();
