import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MTCaptchaOptions } from './mtcaptcha.types';

@Injectable({
  providedIn: 'root'
})
export class MTCaptchaService {

  /** Emits verified tokens to Angular components */
  private tokenSubject = new BehaviorSubject<string | null>(null);
  token$ = this.tokenSubject.asObservable();

  constructor() {
    const W = window as any;

    // Listen for global event (from index.html)
    window.addEventListener('mtcaptcha-token', (e: any) => {
      console.log("Service received token:", e.detail);
      this.tokenSubject.next(e.detail);
    });

    // Preload token if captcha solved before Angular boot
    if (W.__mtcaptcha_preload_token) {
      console.log("Service preload token:", W.__mtcaptcha_preload_token);
      this.tokenSubject.next(W.__mtcaptcha_preload_token);
    }
  }

  /**
   * Apply global MTCaptcha V1 settings
   */
  setGlobalConfig(options: MTCaptchaOptions) {
    const W = window as any;

    W.mtcaptchaConfig = {
      sitekey: options.sitekey,
      lang: options.language || 'en',
      callback: W.onMTCaptchaVerified   // global callback
    };
  }

  /**
   * Return latest token (sync)
   */
  getVerifiedToken(): string | null {
    return this.tokenSubject.getValue();
  }
}
