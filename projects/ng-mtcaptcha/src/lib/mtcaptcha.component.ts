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
  @Input() widgetSize: 'mini' | 'standard' = 'standard';
  @Input() customLangText?: Record<string, any> | string;
  @Input() customStyle?: Record<string, any> | string;
  
  @Output() token = new EventEmitter<string>();
  @Output() rendered = new EventEmitter<void>();
  @Output() expired = new EventEmitter<void>();
  @Output() error = new EventEmitter<any>();

  @ViewChild('captchaContainer', { static: true }) captchaContainer!: ElementRef<HTMLDivElement>;

  captchaId: string;
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

  ngAfterViewInit(): void {
    // Validate required input
    if (!this.sitekey) {
      this.zone.run(() => {
        this.error.emit(new Error('MTCaptcha sitekey is required'));
      });
      return;
    }

    // Set up basic config BEFORE loading scripts (required by MTCaptcha)
    const windowAny = window as any;
    if (!windowAny.mtcaptchaConfig) {
      windowAny.mtcaptchaConfig = {};
    }
    // Set sitekey and callbacks in config before scripts load
    windowAny.mtcaptchaConfig.sitekey = this.sitekey;
    windowAny.mtcaptchaConfig['rendered-callback'] = 'mt_renderedcb';
    windowAny.mtcaptchaConfig['verified-callback'] = 'mt_verifiedcb';
    windowAny.mtcaptchaConfig['verifyexpired-callback'] = 'mt_verifyexpiredcb';
    windowAny.mtcaptchaConfig['error-callback'] = 'mt_errorcb';
    if (!windowAny.mtcaptchaConfig.renderQueue) {
      windowAny.mtcaptchaConfig.renderQueue = [];
    }

    // Automatically load MTCaptcha script if not already loaded
    this.mtcaptchaService.loadScript().subscribe({
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
      widgetSize: this.widgetSize,
      // Set callbacks to use service callbacks
      'rendered-callback': 'mt_renderedcb',
      'verified-callback': 'mt_verifiedcb',
      'verifyexpired-callback': 'mt_verifyexpiredcb',
      'error-callback': 'mt_errorcb',
    };

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

    // Subscribe to verified callback for token (primary method)
    this.subscriptions.push(
      this.mtcaptchaService.verified$.subscribe((token) => {
        if (token && typeof token === 'string') {
          this.zone.run(() => {
            this.token.emit(token);
          });
        }
      })
    );

    // Also subscribe to token$ as fallback (for mtcaptcha-token event)
    this.subscriptions.push(
      this.mtcaptchaService.token$.subscribe((token) => {
        if (token && typeof token === 'string') {
          this.zone.run(() => {
            this.token.emit(token);
          });
        }
      })
    );

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

  ngOnDestroy(): void {
    // Unsubscribe from all service observables
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
}
