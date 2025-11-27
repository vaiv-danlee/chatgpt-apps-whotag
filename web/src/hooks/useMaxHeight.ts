import { useSyncExternalStore } from 'react';

export function useMaxHeight(): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const handleResize = () => onChange();
      window.addEventListener('resize', handleResize);
      window.addEventListener('openai:set_globals', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('openai:set_globals', handleResize);
      };
    },
    () => {
      // ChatGPT Apps SDK provides max height through displayInfo
      // Subtract space for ChatGPT's input bar (approximately 100px)
      const maxHeight = window.openai?.displayInfo?.maxHeight ?? window.innerHeight;
      const chatInputBarHeight = 100;
      return maxHeight - chatInputBarHeight;
    }
  );
}
