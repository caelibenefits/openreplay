function isMobile() {
  // Caeli: upstream treated ANY localhost window under 1280px as a phone (a
  // dev shortcut), which hides the player's whole control bar. We run the
  // dashboard on localhost for real, so detect the device like production.
  if (
    (navigator as any).userAgentData &&
    typeof (navigator as any).userAgentData.mobile === 'boolean'
  ) {
    return (navigator as any).userAgentData.mobile;
  }
  if (window.matchMedia?.('(pointer: coarse)').matches) {
    return true; // likely a touch-first device
  }

  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(
    navigator.userAgent,
  );
}

export const mobileScreen = isMobile();
