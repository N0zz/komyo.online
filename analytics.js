// Komyo Games analytics — GA4, loaded ONLY after the visitor consents on the home page.
// Consent lives in localStorage('gamekit_consent') and is shared across komyo.online,
// so a single "Accept" enables per-game pageview tracking on every game too.
(function () {
  var GA_ID = 'G-S4JQPYNDNM';
  var loaded = false;
  // Inside a Discord Activity everything is served from <app>.discordsays.com and external hosts must go
  // through the /.proxy/<prefix> mappings. Load gtag via /.proxy/gtm and point its hit transport at
  // /.proxy/ga (gtag's own transport_url knob) so event/click counts land. (Storage doesn't persist in an
  // Activity, so the client_id / unique-user count is unreliable — we only care about aggregate events.)
  var IN_ACTIVITY = false;
  try { IN_ACTIVITY = /(^|\.)discordsays\.com$/i.test(location.hostname); } catch (e) {}
  // Dev origins never talk to GA4. Not about traffic volume — a dev session is a handful of hits but
  // they're SYNTHETIC RUNS, and those bend the averages that matter (score, duration_s, completion
  // and share funnels) far more than they bend any count. Consent is per-origin, so localhost was
  // already quiet unless you clicked Accept there; this makes it impossible to do by accident.
  // Private LAN addresses count as dev too: `python3 -m http.server` reached from a phone on the same
  // wifi is served over the machine's 192.168./10./172.16-31. address, which is still a synthetic run.
  // (172.16.0.0/12 = 172.16–172.31 — .32+ is public space and must stay trackable.)
  var DEV = false;
  try {
    DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /\.local$/i.test(location.hostname)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(location.hostname)
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(location.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(location.hostname);
  } catch (e) {}
  window.gamekitLoadGA = function () {
    if (loaded || DEV) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = (IN_ACTIVITY ? '/.proxy/gtm' : 'https://www.googletagmanager.com') + '/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, IN_ACTIVITY ? { transport_url: location.origin + '/.proxy/ga' } : {});
    pingAudioState();
    pingContext();
  };

  // Aggregate, ANONYMOUS product-usage events. No-op unless the visitor consented (gtag only
  // exists after Accept) — the exact same gate as pageviews, so nothing fires on decline or
  // headless. Send event counts only, never per-user data (keeps the no-accounts / device-only
  // ethos). Any caller anywhere (kit, catalogue) uses window.gamekitTrack(name, params).
  window.gamekitTrack = function (name, params) {
    try {
      if (!name || DEV || typeof window.gtag !== 'function') return;
      if (localStorage.getItem('gamekit_consent') !== 'granted') return;
      window.gtag('event', name, params || {});
    } catch (e) {}
  };

  // One coarse snapshot of audio prefs per tab-session — so we can see, in aggregate, how many
  // players keep sound / music on vs. off (informs whether music should default to opt-in).
  function pingAudioState() {
    try {
      if (sessionStorage.getItem('gamekit_audio_pinged')) return;
      var sfxOn = localStorage.getItem('gamekit_sfx_muted') !== '1';
      var musOn = localStorage.getItem('gamekit_music_muted') !== '1';
      window.gamekitTrack('audio_state', { sfx: sfxOn ? 'on' : 'off', music: musOn ? 'on' : 'off' });
      sessionStorage.setItem('gamekit_audio_pinged', '1');
    } catch (e) {}
  }

  // One coarse snapshot per tab-session of HOW the site is being run: an installed PWA window, a
  // Discord Activity or a plain tab, plus the language the player actually picked (GA4's built-in
  // `language` is the browser's, which is a different question). Segments every other report.
  function pingContext() {
    try {
      if (sessionStorage.getItem('gamekit_ctx_pinged')) return;
      // values are named for the READER of the report, not for the platform APIs they come from
      // ('standalone' is the CSS display-mode value, 'activity' is Discord's term — neither reads well)
      var mode = 'browser';
      if (IN_ACTIVITY) mode = 'discord';
      else if (navigator.standalone === true) mode = 'pwa';
      else if (typeof matchMedia === 'function'
        && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches)) mode = 'pwa';
      window.gamekitTrack('app_context', { run_mode: mode, lang: localStorage.getItem('gamekit_lang') || 'en' });
      sessionStorage.setItem('gamekit_ctx_pinged', '1');
    } catch (e) {}
  }

  // Uncaught errors, aggregate only: WHERE it broke (file:line) + a truncated message, never a stack
  // and never anything the player typed. Capped per tab-session so one looping error can't spam GA4.
  var errLeft = 3;
  function trackError(where, msg) {
    if (errLeft <= 0) return;
    errLeft--;
    window.gamekitTrack('js_error', { where: String(where || '?').slice(0, 100), msg: String(msg || '?').slice(0, 100) });
  }
  try {
    window.addEventListener('error', function (e) {
      if (!e) return;
      var f = String(e.filename || '').split('/').slice(-2).join('/');
      trackError(f + ':' + (e.lineno || 0), (e.message || ''));
    });
    window.addEventListener('unhandledrejection', function (e) {
      var r = e && e.reason;
      trackError('promise', (r && (r.message || r)) || '');
    });
  } catch (e) {}

  try {
    if (localStorage.getItem('gamekit_consent') === 'granted') window.gamekitLoadGA();
  } catch (e) {}
})();
