import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject, Observable, Subscriber } from 'rxjs';
import { MTCaptchaOptions } from './mtcaptcha.types';

@Injectable({
  providedIn: 'root'
})
export class MTCaptchaService {

  private readonly MTCAPTCHA_SCRIPT_URL = 'https://service.mtcaptcha.com/mtcv1/client/mtcaptcha.min.js';
  private readonly MTCAPTCHA_SCRIPT2_URL = 'https://service2.mtcaptcha.com/mtcv1/client/mtcaptcha2.min.js';

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
        // Extract token string from event detail (could be string or object)
        let token: string;
        if (typeof e.detail === 'string') {
          token = e.detail;
        } else if (e.detail && typeof e.detail === 'object') {
          token = e.detail.token || e.detail.value || e.detail.detail || e.detail.data || JSON.stringify(e.detail);
          if (typeof token !== 'string') {
            token = String(e.detail);
          }
        } else {
          token = String(e.detail || '');
        }
        
        if (token && token !== 'null' && token !== 'undefined') {
          this.tokenSubject.next(token);
        }
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
    windowAny.mt_verifiedcb = (token: any) => {
      // Extract token string - could be string or object
      let tokenString: string;
      if (typeof token === 'string') {
        tokenString = token;
      } else if (token && typeof token === 'object') {
        // If it's an object, try to extract the token
        // Check common properties where token might be stored
        tokenString = token.token || token.value || token.detail || token.data || JSON.stringify(token);
        // If still an object, try to stringify it properly
        if (typeof tokenString !== 'string') {
          tokenString = String(token);
        }
      } else {
        tokenString = String(token || '');
      }
      
      if (tokenString && tokenString !== 'null' && tokenString !== 'undefined') {
        this.verifiedSubject.next(tokenString);
        this.tokenSubject.next(tokenString);
      }
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
    };

    // Add theme if provided (supports any theme value, not just 'light'|'dark')
    if (options.theme) {
      config.theme = options.theme;
    }

    // Add widgetSize if provided (default: 'standard')
    if (options.widgetSize) {
      config.widgetSize = options.widgetSize;
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
   * Returns the token if captcha is solved, null if not solved or expired
   */
  getVerifiedToken(): string | null {
    return this.tokenSubject.getValue();
  }

  /**
   * Show mandatory error on captcha if not solved
   * Call this when user tries to submit form without solving captcha
   */
  showMandatory(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const windowAny = window as any;
    if (typeof windowAny.mtcaptcha !== 'undefined' && typeof windowAny.mtcaptcha.showMandatory === 'function') {
      windowAny.mtcaptcha.showMandatory();
    }
  }

  /**
   * Load the MTCaptcha script by appending a script element to the head element.
   * The script won't be loaded again if it has already been loaded.
   * Async and defer are set to prevent blocking the renderer while loading MTCaptcha.
   */
  loadScript(): Observable<void> {
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

      // Build script URLs
      const scriptUrl = this.MTCAPTCHA_SCRIPT_URL;
      const script2Url = this.MTCAPTCHA_SCRIPT2_URL;

      let scriptsLoaded = 0;
      const totalScripts = 2;
      let hasError = false;

      const checkComplete = () => {
        if (hasError) return;
        if (scriptsLoaded === totalScripts) {
          console.log('All MTCaptcha scripts loaded successfully');
          observer.next();
          observer.complete();
        }
      };

      const handleError = (url: string, e: any) => {
        if (hasError) return;
        hasError = true;
        console.error('MTCaptcha script loading failed:', {
          url: url,
          error: e,
        });
        const error = new Error(`Failed to load MTCaptcha script from ${url}`);
        (error as any).originalEvent = e;
        observer.error(error);
      };

      // Load first script
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.onerror = (e) => handleError(scriptUrl, e);
      script.onload = () => {
        scriptsLoaded++;
        checkComplete();
      };

      // Load second script
      const script2 = document.createElement('script');
      script2.src = script2Url;
      script2.async = true;
      script2.defer = true;
      script2.onerror = (e) => handleError(script2Url, e);
      script2.onload = () => {
        scriptsLoaded++;
        checkComplete();
      };

      console.log('Loading MTCaptcha scripts from:', scriptUrl, 'and', script2Url);
      document.head.appendChild(script);
      document.head.appendChild(script2);
    });
  }
}
