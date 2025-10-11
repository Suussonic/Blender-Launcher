import React from 'react';

type InAppWebProps = {
  url: string;
  onNavigated?: (url: string, kind?: 'in-page' | 'full' | 'new-window') => void;
  onCanGo?: (state: { canGoBack: boolean; canGoForward: boolean }) => void;
  reloadKey?: number; // force remount to clear history
};

export type InAppWebHandle = {
  goBack: () => void;
  goForward: () => void;
};

const InAppWeb = React.forwardRef<InAppWebHandle, InAppWebProps>(({ url, onNavigated, onCanGo, reloadKey }, forwardedRef) => {
  const webviewRef = React.useRef<any>(null);
  // Flag to ignore the next navigate event when navigation is triggered by prop change (programmatic)
  const ignoreNextRef = React.useRef<boolean>(false);

  // When the url prop changes, mark the next navigation as programmatic
  React.useEffect(() => {
    ignoreNextRef.current = true;
  }, [url]);

  React.useEffect(() => {
  const v = webviewRef.current as any;
    if (!v) return;

    const onDidNavigate = (e: any) => {
      const nextUrl = e?.url || '';
      if (ignoreNextRef.current) {
        ignoreNextRef.current = false;
        return;
      }
      onNavigated && onNavigated(nextUrl, 'full');
    };
    const onDidNavigateInPage = (e: any) => {
      const nextUrl = e?.url || '';
      if (ignoreNextRef.current) {
        ignoreNextRef.current = false;
        return;
      }
      onNavigated && onNavigated(nextUrl, 'in-page');
    };
    const onWillNavigate = (e: any) => {
      // we let it happen; did-navigate will follow
    };
    const onNewWindow = (e: any) => {
      // Prevent external popup; open inside the same webview
      try { e.preventDefault && e.preventDefault(); } catch {}
      const target = e?.url || '';
      if (target) {
        try { v.src = target; } catch {}
        // This is programmatic from our side, ignore the navigate event once
        ignoreNextRef.current = true;
        onNavigated && onNavigated(target, 'new-window');
      }
    };

    const updateCanGo = () => {
      try {
        const canBack = typeof v.canGoBack === 'function' ? !!v.canGoBack() : false;
        const canForward = typeof v.canGoForward === 'function' ? !!v.canGoForward() : false;
        onCanGo && onCanGo({ canGoBack: canBack, canGoForward: canForward });
      } catch {}
    };

    const onDidNavigateAny = (e:any) => {
      onDidNavigate(e);
      updateCanGo();
    };
    v.addEventListener('did-navigate', onDidNavigateAny);
    v.addEventListener('did-navigate-in-page', onDidNavigateInPage);
    v.addEventListener('will-navigate', onWillNavigate);
    v.addEventListener('new-window', onNewWindow);
    // DOM ready: webview API available
    const onDomReady = () => { 
      try { (window as any).__bl_webview = v; } catch {}
      console.log('[InAppWeb] dom-ready', v?.getURL?.());
      updateCanGo(); 
    };
    v.addEventListener('dom-ready', onDomReady);
    v.addEventListener('did-start-loading', updateCanGo);
    v.addEventListener('did-stop-loading', updateCanGo);
    return () => {
      try {
        v.removeEventListener('did-navigate', onDidNavigateAny);
        v.removeEventListener('did-navigate-in-page', onDidNavigateInPage);
        v.removeEventListener('will-navigate', onWillNavigate);
        v.removeEventListener('new-window', onNewWindow);
        v.removeEventListener('dom-ready', onDomReady);
        v.removeEventListener('did-start-loading', updateCanGo);
        v.removeEventListener('did-stop-loading', updateCanGo);
      } catch {}
    };
  }, [onNavigated, onCanGo]);

  // Imperative API to control native history
  React.useImperativeHandle(forwardedRef, () => ({
    goBack: () => {
      const v = (webviewRef.current as any);
      try { v.goBack?.(); } catch {}
      // Re-evaluate canGo after a short delay since navigation is async
      setTimeout(() => {
        try {
          const canBack = typeof v.canGoBack === 'function' ? !!v.canGoBack() : false;
          const canForward = typeof v.canGoForward === 'function' ? !!v.canGoForward() : false;
          onCanGo && onCanGo({ canGoBack: canBack, canGoForward: canForward });
        } catch {}
      }, 120);
    },
    goForward: () => {
      const v = (webviewRef.current as any);
      try { v.goForward?.(); } catch {}
      setTimeout(() => {
        try {
          const canBack = typeof v.canGoBack === 'function' ? !!v.canGoBack() : false;
          const canForward = typeof v.canGoForward === 'function' ? !!v.canGoForward() : false;
          onCanGo && onCanGo({ canGoBack: canBack, canGoForward: canForward });
        } catch {}
      }, 120);
    },
  }));

  return (
    <div key={String(reloadKey || 0)} style={{ position: 'relative', width: '100%', height: '100%', background: '#0b1016' }}>
      {/* Use Electron webview for better site compatibility inside the launcher */}
      {/* @ts-ignore */}
      <webview
        ref={webviewRef}
        src={url}
        style={{ width: '100%', height: '100%' }}
        // Do NOT allow popups; we intercept and load inside
        // allowpopups
        disableguestresize
      />
    </div>
  );
});

export default InAppWeb;
