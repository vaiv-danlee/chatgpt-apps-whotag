import { useSyncExternalStore } from 'react';

interface OpenAiGlobals {
  toolInput: any;
  toolOutput: any;
  toolResponseMetadata: any;
  widgetState: any;
  theme: 'light' | 'dark';
  locale: string;
  [key: string]: any;
}

declare global {
  interface Window {
    openai: OpenAiGlobals & {
      setWidgetState: (state: any) => Promise<void>;
      callTool: (name: string, args: any) => Promise<any>;
      sendFollowUpMessage: (args: { prompt: string }) => Promise<void>;
      openExternal: (payload: { href: string }) => void;
      requestDisplayMode: (args: { mode: string }) => Promise<any>;
    };
  }

  interface SetGlobalsEvent extends CustomEvent {
    detail: {
      globals: Partial<OpenAiGlobals>;
    };
  }
}

export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] {
  return useSyncExternalStore(
    (onChange) => {
      const handleSetGlobal = (event: Event) => {
        const customEvent = event as SetGlobalsEvent;
        if (customEvent.detail?.globals[key] !== undefined) {
          onChange();
        }
      };
      window.addEventListener('openai:set_globals', handleSetGlobal);
      return () => {
        window.removeEventListener('openai:set_globals', handleSetGlobal);
      };
    },
    () => window.openai?.[key]
  );
}
