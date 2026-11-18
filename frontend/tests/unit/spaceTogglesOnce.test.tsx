import { describe, expect, it, jest } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PlayerContext } from 'Components/Session/playerContext';
import useShortcuts from 'Components/Session/Player/ReplayPlayer/useShortcuts';
import PlayIconLayer from 'Components/Session_/Player/Overlay/PlayIconLayer';

// The real Controls module pulls react-dnd (ESM), which Jest cannot parse;
// both components only read SKIP_INTERVALS from it.
jest.mock('Components/Session_/Player/Controls/Controls', () => ({
  SKIP_INTERVALS: { 2: 2000, 5: 5000, 10: 10000, 15: 15000 },
}));
jest.mock('App/mstore', () => ({
  useStore: () => ({ sessionStore: { createNoteTooltip: { isVisible: false } } }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Caeli: the replay page mounts both the controls' shortcuts and the overlay's
// play layer. Both used to toggle on Space, so one press paused and resumed at
// once (the overlay flashed its icon and playback kept going).
describe('Space on the replay page', () => {
  it('toggles playback exactly once', () => {
    const player = { togglePlay: jest.fn(), toggleInspectorMode: jest.fn() };
    function Shortcuts() {
      useShortcuts({
        skipInterval: 2 as any,
        fullScreenOn: () => {},
        fullScreenOff: () => {},
        toggleBottomBlock: () => {},
        openNextSession: () => {},
        openPrevSession: () => {},
        setActiveTab: () => {},
      });
      return null;
    }
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() =>
      root.render(
        <PlayerContext.Provider value={{ player, store: { get: () => ({}) } } as any}>
          <Shortcuts />
          <PlayIconLayer playing togglePlay={() => player.togglePlay()} jumpInterval={() => {}} />
        </PlayerContext.Provider>,
      ),
    );
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(player.togglePlay).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    el.remove();
  });
});
