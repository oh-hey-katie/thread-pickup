(() => {
  let timer, last = '', running = false;
  async function capture() {
    // Switching to the shelf must not prevent the ChatGPT tab from delivering its capture.
    if (running) return;
    running = true;
    try {
      try { ThreadPickupDiscovery.step(document, location.href); }
      catch { /* Discovery must never prevent passive capture. */ }
      const observation = ThreadPickupCapture.read(document, location.href);
      const signature = JSON.stringify(observation);
      if (signature === last) return;
      const result = await chrome.runtime.sendMessage({type:'observe', observation});
      if (result?.ok) last = signature;
    } catch { /* A reload or extension update is retried on the next observation. */ }
    finally { running = false; }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(capture, 900); }
  new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','aria-expanded','data-talvt-turn-state']});
  document.addEventListener('visibilitychange',schedule);
  window.addEventListener('popstate',schedule);
  // Also detects same-document navigation and recovers after a service-worker restart.
  setInterval(capture, 5000);
  schedule();
})();
