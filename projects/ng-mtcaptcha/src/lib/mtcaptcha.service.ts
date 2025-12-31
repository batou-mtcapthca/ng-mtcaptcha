import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { MTCaptchaOptions } from './mtcaptcha.types';

@Injectable({
  providedIn: 'root'
})
export class MTCaptchaService {

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

  constructor() {
    // Listen for global event (from index.html)
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
   */
  setGlobalConfig(options: MTCaptchaOptions) {
    const windowAny = window as any;

    const config: any = {
      sitekey: options.sitekey,
      lang: options.language || 'en',
    };

    // Add theme if provided
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

    windowAny.mtcaptchaConfig = config;
  }

  /**
   * Return latest token (sync)
   */
  getVerifiedToken(): string | null {
    return this.tokenSubject.getValue();
  }
}
