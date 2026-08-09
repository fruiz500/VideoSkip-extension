(function () {
  const POLL_INTERVAL_MS = 250;

  function fromHMS(hms) {
    if (!hms) return 0;
    let a = hms.split(':');
    if (a.length === 3) return (+a[0]) * 3600 + (+a[1]) * 60 + (+a[2]);
    if (a.length === 2) return (+a[0]) * 60 + (+a[1]);
    return 0;
  }

  function findAmazonTimeFromFiber(element) {
    if (!element) return null;

    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < 20) {
      const reactKey = Object.keys(current).find(k => 
        k.startsWith('__reactFiber$') || k.startsWith('__reactProps$')
      );

      if (reactKey) {
        const fiber = current[reactKey];
        
        // Walk Fiber return stack (upward through React component tree)
        let currFiber = fiber;
        let fiberDepth = 0;
        while (currFiber && fiberDepth < 30) {
          const props = currFiber.memoizedProps || currFiber.pendingProps;
          if (props) {
            if (typeof props.currentTime === 'number' && !isNaN(props.currentTime) && props.currentTime > 0) {
              return props.currentTime;
            }
            if (props.playerState && typeof props.playerState.currentTime === 'number') {
              return props.playerState.currentTime;
            }
            if (props.sdk && props.sdk.getCurrentTime) {
              try { return props.sdk.getCurrentTime(); } catch(e){}
            }
          }
          currFiber = currFiber.return;
          fiberDepth++;
        }
      }
      current = current.parentElement;
      depth++;
    }
    return null;
  }

  function getUIClockTime() {
    try {
      const clockSelectors = [
        '.atvwebplayersdk-timeindicator-text',
        '.f4cgkp5',
        '[class*="timeindicator-text"]',
        '[class^="clock"]',
        '[class*="clock"]',
        '[class*="time-display"]',
        '[class*="timeDisplay"]'
      ];

      for (let selector of clockSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          const match = el.textContent.match(/\d+:\d{2}(?::\d{2})?/);
          if (match) {
            return fromHMS(match[0]);
          }
        }
      }
    } catch (err) {
      // Guard against unmounting
    }
    return null;
  }

  setInterval(function () {
    const videos = Array.from(document.querySelectorAll('video'));
    let rawVideo = videos.find(v => !v.paused && v.readyState > 0);
    
    if (!rawVideo && videos.length > 0) {
      rawVideo = videos.reduce((prev, current) => (prev.currentTime > current.currentTime) ? prev : current);
    }

    if (!rawVideo) return;

    const mediaTime = rawVideo.currentTime || 0;
    
    // Primary: Fiber search; Secondary: UI clock fallback
    let internalTime = findAmazonTimeFromFiber(rawVideo) || getUIClockTime();

    if (internalTime !== null) {
      const calculatedAdSeconds = Math.max(0, mediaTime - internalTime);

      window.postMessage(
        {
          type: 'VS_AMAZON_TIME_UPDATE',
          internalTime: internalTime,
          mediaTime: mediaTime,
          adSeconds: calculatedAdSeconds
        },
        '*'
      );
    }
  }, POLL_INTERVAL_MS);
})();