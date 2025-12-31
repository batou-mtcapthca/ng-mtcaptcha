import {
  Component,
  Input,
  AfterViewInit,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  NgZone,
  OnDestroy,
  ElementRef,
  ViewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import { MTCaptchaService } from './mtcaptcha.service';

@Component({
  selector: 'ng-mtcaptcha',
  standalone: true,
  imports: [],
  template: `
    <div
      #captchaContainer
      [id]="captchaId"
      class="mtcaptcha">
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MTCaptchaComponent implements AfterViewInit, OnDestroy {

  @Input() sitekey = "";
  @Input() theme?: string;
  @Input() language?: string;
  @Input() customLangText?: Record<string, any> | string;
  @Input() customStyle?: Record<string, any> | string;
  
  @Output() token = new EventEmitter<string>();
  @Output() rendered = new EventEmitter<void>();
  @Output() expired = new EventEmitter<void>();
  @Output() error = new EventEmitter<any>();

  @ViewChild('captchaContainer', { static: true }) captchaContainer!: ElementRef<HTMLDivElement>;

  captchaId: string;
  private intervalId?: any;
  private subscriptions: Subscription[] = [];

  constructor(
    private zone: NgZone,
    private mtcaptchaService: MTCaptchaService
  ) {
    // Generate unique ID for this captcha instance (supports multiple captchas on same page)
    this.captchaId = `mtcaptcha-${Math.random().toString(36).substring(2, 11)}`;
    
    // Subscribe to service observables and emit component events
    this.subscriptions.push(
      this.mtcaptchaService.rendered$.subscribe(() => {
        this.zone.run(() => {
          this.rendered.emit();
        });
      })
    );

    this.subscriptions.push(
      this.mtcaptchaService.verifyexpired$.subscribe(() => {
        this.zone.run(() => {
          this.expired.emit();
        });
      })
    );

    this.subscriptions.push(
      this.mtcaptchaService.error$.subscribe((error) => {
        this.zone.run(() => {
          this.error.emit(error);
        });
      })
    );
  }

  private tokenListener = (e: any) => {
    const token = e.detail;
    if (!token) return;

    this.zone.run(() => {
      this.token.emit(token);
    });
  };

  ngAfterViewInit(): void {
    // Validate required input
    if (!this.sitekey) {
      this.zone.run(() => {
        this.error.emit(new Error('MTCaptcha sitekey is required'));
      });
      return;
    }

    // Automatically load MTCaptcha script if not already loaded
    // Pass language code if provided for efficient loading
    this.mtcaptchaService.loadScript(this.language).subscribe({
      next: () => {
        // Script loaded, now configure and render captcha using explicit rendering
        this.renderCaptcha();
      },
      error: (err) => {
        // Script loading failed - component will still attempt to render
        // in case script was loaded manually
        this.zone.run(() => {
          this.error.emit(err);
        });
        this.renderCaptcha();
      }
    });
  }

  private renderCaptcha(): void {
    const windowAny = window as any;

    // Ensure mtcaptchaConfig exists
    if (!windowAny.mtcaptchaConfig) {
      windowAny.mtcaptchaConfig = {};
    }

    // Ensure renderQueue exists
    if (!windowAny.mtcaptchaConfig.renderQueue) {
      windowAny.mtcaptchaConfig.renderQueue = [];
    }

    // Set component-specific configuration
    const config: any = {
      sitekey: this.sitekey,
    };

    if (this.language) {
      config.lang = this.language;
    }

    if (this.theme) {
      config.theme = this.theme;
    }

    if (this.customLangText) {
      config.customLangText = typeof this.customLangText === 'string'
        ? JSON.parse(this.customLangText)
        : this.customLangText;
    }

    if (this.customStyle) {
      config.customStyle = typeof this.customStyle === 'string'
        ? JSON.parse(this.customStyle)
        : this.customStyle;
    }

    // Merge component config with global config (preserve renderQueue)
    const existingRenderQueue = windowAny.mtcaptchaConfig.renderQueue || [];
    windowAny.mtcaptchaConfig = {
      ...windowAny.mtcaptchaConfig,
      ...config,
      renderQueue: existingRenderQueue
    };

    // Set up listeners for this specific captcha instance
    this.setupListeners();

    // Use explicit rendering - add this captcha's ID to render queue
    // This allows multiple captchas on the same page (critical for SPA)
    if (typeof windowAny.renderExplicitCaptcha === 'function') {
      // If renderExplicitCaptcha is available, use it
      windowAny.mtcaptchaConfig.renderQueue.push(this.captchaId);
      windowAny.renderExplicitCaptcha();
    } else {
      // Fallback: wait for script to be fully ready
      const checkAndRender = setInterval(() => {
        if (typeof windowAny.renderExplicitCaptcha === 'function') {
          windowAny.mtcaptchaConfig.renderQueue.push(this.captchaId);
          windowAny.renderExplicitCaptcha();
          clearInterval(checkAndRender);
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkAndRender), 5000);
    }
  }

  private setupListeners(): void {
    // Listen for v2-style event — safe fallback
    window.addEventListener("mtcaptcha-token", this.tokenListener);

    // Poll for v1 hidden field — required for v1
    // Use component-specific selector to support multiple captchas
    this.intervalId = setInterval(() => {
      const container = document.getElementById(this.captchaId);
      if (!container) return;

      const el = container.querySelector<HTMLInputElement>(".mtcaptcha-verifiedtoken");
      if (!el) return;

      const value = el.value;
      if (value && value.startsWith("v1(")) {
        this.zone.run(() => {
          this.token.emit(value);
        });

        clearInterval(this.intervalId);
      }
    }, 300);
  }

  ngOnDestroy(): void {
    window.removeEventListener("mtcaptcha-token", this.tokenListener);
    if (this.intervalId) clearInterval(this.intervalId);
    
    // Unsubscribe from all service observables
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
}
