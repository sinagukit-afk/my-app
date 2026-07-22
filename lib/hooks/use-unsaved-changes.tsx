"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface UnsavedChangesContextValue {
  setDirty: (dirty: boolean) => void;
  guardedRun: (action: () => void) => void;
}

const UnsavedChangesContext = React.createContext<UnsavedChangesContextValue | null>(null);

/**
 * Mounted once in AppShell. Holds whether any currently-registered form is dirty, warns on tab
 * close/refresh via beforeunload, and gates in-app navigation (sidebar, breadcrumb, back/forward,
 * PageHeader back link) behind a confirm dialog. Deliberately NOT consulted for the redirect a
 * form issues right after its own successful save — that path calls router.replace() directly.
 */
export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const isDirtyRef = React.useRef(false);
  const [pendingAction, setPendingAction] = React.useState<(() => void) | null>(null);

  const setDirty = React.useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const guardedRun = React.useCallback((action: () => void) => {
    if (isDirtyRef.current) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }, []);

  const value = React.useMemo(() => ({ setDirty, guardedRun }), [setDirty, guardedRun]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes on this page. Leaving now will discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Stay on page
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                const action = pendingAction;
                isDirtyRef.current = false;
                setPendingAction(null);
                action?.();
              }}
            >
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
}

function useUnsavedChangesContext(): UnsavedChangesContextValue {
  const ctx = React.useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges hooks must be used within UnsavedChangesProvider (mounted in AppShell)");
  }
  return ctx;
}

/** Forms call this with their live dirty state (e.g. react-hook-form's formState.isDirty). */
export function useRegisterUnsavedChanges(isDirty: boolean) {
  const { setDirty } = useUnsavedChangesContext();
  React.useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);
}

/**
 * Navigation helpers that check the registered dirty state first. Use for anything the user
 * clicks to *leave* the current form (Cancel, back link, sidebar/breadcrumb, back/forward).
 * Never use for the redirect a form does immediately after its own successful save.
 */
export function useGuardedNavigate() {
  const router = useRouter();
  const { guardedRun } = useUnsavedChangesContext();

  return React.useMemo(
    () => ({
      push: (href: string) => guardedRun(() => router.push(href)),
      back: () => guardedRun(() => router.back()),
      forward: () => guardedRun(() => router.forward()),
      run: (action: () => void) => guardedRun(action),
    }),
    [guardedRun, router]
  );
}

/**
 * Click handler factory for plain `<Link href>` elements (sidebar nav, breadcrumb) that should
 * respect unsaved-changes guarding. Leaves modifier-key clicks (open in new tab, etc.) alone.
 */
export function useGuardedLinkClick() {
  const { push } = useGuardedNavigate();
  return React.useCallback(
    (href: string) => (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      push(href);
    },
    [push]
  );
}
