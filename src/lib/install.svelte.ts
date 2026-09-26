// Installing the app (home screen, app drawer, desktop). Chrome, Edge and Samsung Internet
// offer an install prompt we can trigger from our own button; Safari needs a short guide.

import { isIOS, isMacSafari, isStandalone } from './platform';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class Install {
  /** The browser's install prompt, when it has offered one. */
  deferred = $state.raw<InstallPromptEvent | null>(null);
  installed = $state(isStandalone());

  /** 'prompt' = our button opens the browser's dialog; 'ios' / 'mac' = show how; null = not possible here. */
  get method(): 'prompt' | 'ios' | 'mac' | null {
    if (this.installed) return null;
    if (this.deferred) return 'prompt';
    if (isIOS()) return 'ios';
    if (isMacSafari()) return 'mac';
    return null;
  }

  listen(): void {
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as InstallPromptEvent;
    });
    addEventListener('appinstalled', () => {
      this.installed = true;
      this.deferred = null;
    });
    window.matchMedia?.('(display-mode: standalone)').addEventListener('change', (e) => (this.installed = e.matches));
  }

  /** Open the browser's install dialog. Resolves true if the user installed. */
  async prompt(): Promise<boolean> {
    const e = this.deferred;
    if (!e) return false;
    this.deferred = null; // each prompt event can only be used once
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') this.installed = true;
    return outcome === 'accepted';
  }
}

export const install = new Install();
