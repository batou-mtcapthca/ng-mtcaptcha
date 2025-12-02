import {
  Component,
  Input,
  AfterViewInit,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  NgZone,
  OnDestroy
} from '@angular/core';

@Component({
  selector: 'ng-mtcaptcha',
  template: `
    <div
      class="mtcaptcha"
      data-mtcaptcha="true"
      [attr.data-sitekey]="sitekey">
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MTCaptchaComponent implements AfterViewInit, OnDestroy {

  @Input() sitekey = "";
  @Output() token = new EventEmitter<string>();

  private intervalId?: any;

  constructor(private zone: NgZone) { }

  private tokenListener = (e: any) => {
    const token = e.detail;
    if (!token) return;

    this.zone.run(() => {
      console.log(" TOKEN from event (fallback):", token);
      this.token.emit(token);
    });
  };

  ngAfterViewInit(): void {
    console.log("MTCaptcha initialized → watching for v1 token.");

    // Listen for v2-style event — safe fallback
    window.addEventListener("mtcaptcha-token", this.tokenListener);

    // Poll for v1 hidden field — required for v1
    this.intervalId = setInterval(() => {
      const el = document.querySelector<HTMLInputElement>(".mtcaptcha-verifiedtoken");
      if (!el) return;

      const value = el.value;
      if (value && value.startsWith("v1(")) {
        console.log(" Angular detected v1 token:", value);

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
  }
}
