import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject, Observable, Subscriber } from 'rxjs';
import { MTCaptchaOptions } from './mtcaptcha.types';

@Injectable({
  providedIn: 'root'
})
export class MTCaptchaService {

  private readonly MTCAPTCHA_SCRIPT_URL = 'https://service.mtcaptcha.com/mtcaptcha.min.js';

  /** Emits verified tokens to Angular components */
  private tokenSubject = new BehaviorSubject<string | null>(null);
  token$ = this.tokenSubject.asObservable();

  /** Emits when captcha is rendered */
  private renderedSubject = new Subject<void>();
  rendered$ = this.renderedSubject.asObservable();

  /** Emits when captcha is verified */
  private verifiedSubject = new Subject<string>();
  verified$ = this.verifiedSubject.asObservable();

  /** Emits when captcha verification expires */
  private verifyexpiredSubject = new Subject<void>();
  verifyexpired$ = this.verifyexpiredSubject.asObservable();

  /** Emits when captcha encounters an error */
  private errorSubject = new Subject<any>();
  error$ = this.errorSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      // Listen for global event
      window.addEventListener('mtcaptcha-token', (e: any) => {
        this.tokenSubject.next(e.detail);
      });

      // Preload token if captcha solved before Angular boot
      const windowAny = window as any;
      if (windowAny.__mtcaptcha_preload_token) {
        this.tokenSubject.next(windowAny.__mtcaptcha_preload_token);
      }

      // Set up global callback functions that MTCaptcha can call
      this.setupGlobalCallbacks();
    }
  }

  /**
   * Set up global callback functions for MTCaptcha
   */
  private setupGlobalCallbacks(): void {
    const windowAny = window as any;

    // Rendered callback
    windowAny.mt_renderedcb = () => {
      this.renderedSubject.next();
    };

    // Verified callback
    windowAny.mt_verifiedcb = (token: string) => {
      this.verifiedSubject.next(token);
      this.tokenSubject.next(token);
    };

    // Verify expired callback
    windowAny.mt_verifyexpiredcb = () => {
      this.verifyexpiredSubject.next();
      this.tokenSubject.next(null);
    };

    // Error callback
    windowAny.mt_errorcb = (error: any) => {
      this.errorSubject.next(error);
    };

    // Legacy callback support
    windowAny.onMTCaptchaVerified = (token: string) => {
      this.verifiedSubject.next(token);
      this.tokenSubject.next(token);
    };
  }

  /**
   * Apply global MTCaptcha V1 settings
   * Supports explicit rendering with renderQueue for multiple captchas on same page
   */
  setGlobalConfig(options: MTCaptchaOptions) {
    const windowAny = window as any;

    // Initialize mtcaptchaConfig if it doesn't exist
    if (!windowAny.mtcaptchaConfig) {
      windowAny.mtcaptchaConfig = {};
    }

    // Initialize renderQueue for explicit rendering (supports multiple captchas)
    if (!windowAny.mtcaptchaConfig.renderQueue) {
      windowAny.mtcaptchaConfig.renderQueue = [];
    }

    const config: any = {
      sitekey: options.sitekey,
      lang: options.language || 'en',
    };

    // Add theme if provided (supports any theme value, not just 'light'|'dark')
    if (options.theme) {
      config.theme = options.theme;
    }

    // Add custom language text if provided
    if (options.customLangText) {
      config.customLangText = typeof options.customLangText === 'string' 
        ? JSON.parse(options.customLangText) 
        : options.customLangText;
    }

    // Add custom style if provided
    if (options.customStyle) {
      config.customStyle = typeof options.customStyle === 'string'
        ? JSON.parse(options.customStyle)
        : options.customStyle;
    }

    // Set callback names (default to our global callbacks if not specified)
    config['rendered-callback'] = options.renderedCallback || 'mt_renderedcb';
    config['verified-callback'] = options.verifiedCallback || 'mt_verifiedcb';
    config['verifyexpired-callback'] = options.verifyexpiredCallback || 'mt_verifyexpiredcb';
    config['error-callback'] = options.errorCallback || 'mt_errorcb';

    // Legacy callback support
    if (options.callbackName) {
      windowAny[options.callbackName] = windowAny.mt_verifiedcb;
      config.callback = options.callbackName;
    } else {
      config.callback = windowAny.onMTCaptchaVerified;
    }

    // Merge with existing config (preserve renderQueue)
    windowAny.mtcaptchaConfig = {
      ...windowAny.mtcaptchaConfig,
      ...config,
      renderQueue: windowAny.mtcaptchaConfig.renderQueue
    };
  }

  /**
   * Return latest token (sync)
   */
  getVerifiedToken(): string | null {
    return this.tokenSubject.getValue();
  }

  /**
   * Load the MTCaptcha script by appending a script element to the head element.
   * The script won't be loaded again if it has already been loaded.
   * Async and defer are set to prevent blocking the renderer while loading MTCaptcha.
   * 
   * @param languageCode Optional language code to append to script URL
   */
  loadScript(languageCode?: string): Observable<void> {
    return new Observable<void>((observer: Subscriber<void>) => {
      // No window object (SSR)
      if (!isPlatformBrowser(this.platformId)) {
        observer.complete();
        return;
      }

      const windowAny = window as any;

      // The MTCaptcha script has already been loaded (check global object)
      if (typeof windowAny.mtcaptcha !== 'undefined') {
        observer.next();
        observer.complete();
        return;
      }

      // Build script URL with optional language parameter
      let scriptUrl = this.MTCAPTCHA_SCRIPT_URL;
      if (languageCode) {
        const separator = scriptUrl.includes('?') ? '&' : '?';
        scriptUrl += `${separator}lang=${languageCode}`;
      }

      // Create and load script
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;

      script.onerror = (e) => observer.error(e);
      script.onload = () => {
        observer.next();
        observer.complete();
      };

      document.head.appendChild(script);
    });
  }
}
