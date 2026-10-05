import { useEffect } from 'react';
import { Platform } from 'react-native';

export const DEFAULT_DOCUMENT_TITLE = 'Beacon — Ireland’s Esports League Platform';

let desiredTitle = DEFAULT_DOCUMENT_TITLE;
let enforcerStarted = false;

function enforce() {
  if (typeof document !== 'undefined' && document.title !== desiredTitle) {
    document.title = desiredTitle;
  }
}

/** Starts the single, always-on title enforcement loop — call once, from
 * the root layout (AppShell). Why this exists: expo-router/head's
 * Head.Provider is auto-wrapped around the whole app by expo-router
 * itself regardless of whether any screen renders a <Head>, and on this
 * Expo Router + React 19 combination it injects its own empty
 * <title data-rh="true"> ahead of the one app/+html.tsx bakes into the
 * static HTML. That becomes the "first" title element in document order
 * (document.title reads the first one per spec), so it wins — producing
 * a blank browser tab title and, worse, Google indexing the site as
 * "Untitled" — reproducible even with zero <Head> usage anywhere in the
 * app, and alongside a React hydration error (#418) elsewhere in the
 * tree that's never been fully root-caused. Rather than chase that down
 * further, this fights it directly: a MutationObserver on <head>
 * re-asserts whatever the current desired title is the instant anything
 * else changes it. See useDocumentTitle below for setting a page-specific
 * title on top of the site default. */
export function useDocumentTitleEnforcer() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || enforcerStarted) return;
    enforcerStarted = true;
    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  }, []);
}

/** Sets the page-specific title for as long as this component stays
 * mounted, restoring whatever was active before on unmount. Just updates
 * the shared desired value — the single observer started by
 * useDocumentTitleEnforcer is what actually keeps it pinned; this must
 * not start a second observer of its own, or the two fight each other
 * into an oscillating loop. */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const previous = desiredTitle;
    desiredTitle = title ?? DEFAULT_DOCUMENT_TITLE;
    enforce();
    return () => {
      desiredTitle = previous;
      enforce();
    };
  }, [title]);
}
