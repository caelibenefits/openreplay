import { useRef } from 'react';

/**
 * Caeli: a timeline drag pauses a playing replay and resumes it on drop.
 * The "was playing" flag is cleared on every drop; it used to stick after one
 * drag made while playing, so a later drag resumed a replay the viewer had
 * paused.
 */
export default function useResumeAfterDrag(player: {
  pause: () => void;
  play: () => void;
}) {
  const wasPlaying = useRef(false);
  return {
    onDragMove: (playing: boolean) => {
      if (playing) {
        wasPlaying.current = true;
        player.pause();
      }
    },
    onDragEnd: () => {
      const resume = wasPlaying.current;
      wasPlaying.current = false;
      if (resume) player.play();
    },
  };
}
