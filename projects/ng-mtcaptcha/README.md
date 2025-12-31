# ng-mtcaptcha

Angular library for integrating MTCaptcha into Angular applications. This library provides Angular components and services to easily add MTCaptcha verification to your forms.

## Installation

Install the package using npm:

```bash
npm install ng-mtcaptcha
```

## Prerequisites

- Angular 21.0.0 or higher
- MTCaptcha account and sitekey

## Setup

### 1. Load MTCaptcha Script

Add the MTCaptcha script to your `index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MyApp</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  
  <!-- MTCaptcha Script -->
  <script src="https://service.mtcaptcha.com/mtcaptcha.min.js" defer></script>
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

### 2. Import the Module

In your Angular module or standalone component, import `MTCaptchaComponent`:

**For Standalone Components (Angular 14+):**

```typescript
import { Component } from '@angular/core';
import { MTCaptchaComponent } from 'ng-mtcaptcha';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MTCaptchaComponent],
  template: `
    <form>
      <ng-mtcaptcha 
        [sitekey]="sitekey" 
        (token)="onToken($event)">
      </ng-mtcaptcha>
      <button type="submit">Submit</button>
    </form>
  `
})
export class AppComponent {
  sitekey = 'YOUR_MTCAPTCHA_SITEKEY';
  
  onToken(token: string) {
    console.log('MTCaptcha token:', token);
    // Send token to your backend for verification
  }
}
```

**For NgModules:**

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MTCaptchaComponent } from 'ng-mtcaptcha';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    MTCaptchaComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

## Usage

### Basic Component Usage

```html
<ng-mtcaptcha 
  [sitekey]="'YOUR_SITEKEY'" 
  (token)="handleToken($event)">
</ng-mtcaptcha>
```

### Component API

#### Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sitekey` | `string` | Yes | `""` | Your MTCaptcha sitekey |

#### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `token` | `EventEmitter<string>` | Emits the verification token when captcha is solved |

### Service Usage

You can also use the `MTCaptchaService` to access tokens programmatically:

```typescript
import { Component, OnInit } from '@angular/core';
import { MTCaptchaService } from 'ng-mtcaptcha';

@Component({
  selector: 'app-example',
  template: `
    <ng-mtcaptcha [sitekey]="sitekey"></ng-mtcaptcha>
    <button (click)="getToken()">Get Token</button>
  `
})
export class ExampleComponent implements OnInit {
  sitekey = 'YOUR_SITEKEY';
  
  constructor(private mtcaptchaService: MTCaptchaService) {}
  
  ngOnInit() {
    // Subscribe to token updates
    this.mtcaptchaService.token$.subscribe(token => {
      if (token) {
        console.log('Token received:', token);
      }
    });
  }
  
  getToken() {
    const token = this.mtcaptchaService.getVerifiedToken();
    if (token) {
      console.log('Current token:', token);
    } else {
      console.log('No token available yet');
    }
  }
}
```

### Service API

#### Methods

- `getVerifiedToken(): string | null` - Returns the current verified token synchronously
- `setGlobalConfig(options: MTCaptchaOptions): void` - Configure global MTCaptcha settings

#### Observables

- `token$: Observable<string | null>` - Observable that emits tokens when captcha is verified
- `rendered$: Observable<void>` - Observable that emits when captcha is rendered
- `verified$: Observable<string>` - Observable that emits when captcha is verified (includes token)
- `verifyexpired$: Observable<void>` - Observable that emits when captcha verification expires
- `error$: Observable<any>` - Observable that emits when captcha encounters an error

### Type Definitions

```typescript
interface MTCaptchaOptions {
  sitekey: string;
  language?: string;
  theme?: 'light' | 'dark';
  callbackName?: string;
  customLangText?: Record<string, any> | string;  // JSON object or JSON string
  customStyle?: Record<string, any> | string;       // JSON object or JSON string
  renderedCallback?: string;                       // Custom rendered callback name (default: 'mt_renderedcb')
  verifiedCallback?: string;                       // Custom verified callback name (default: 'mt_verifiedcb')
  verifyexpiredCallback?: string;                  // Custom expired callback name (default: 'mt_verifyexpiredcb')
  errorCallback?: string;                           // Custom error callback name (default: 'mt_errorcb')
}
```

### Advanced Configuration Example

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { MTCaptchaService } from 'ng-mtcaptcha';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-advanced',
  template: `<ng-mtcaptcha [sitekey]="sitekey"></ng-mtcaptcha>`
})
export class AdvancedComponent implements OnInit, OnDestroy {
  sitekey = 'YOUR_SITEKEY';
  private subscriptions = new Subscription();

  constructor(private mtcaptchaService: MTCaptchaService) {}

  ngOnInit() {
    // Configure with custom options
    this.mtcaptchaService.setGlobalConfig({
      sitekey: this.sitekey,
      language: 'en',
      theme: 'light',
      customLangText: {
        // Custom language text
        'en': {
          'verify': 'Verify',
          'refresh': 'Refresh'
        }
      },
      customStyle: {
        // Custom styling
        'font-family': 'Arial, sans-serif',
        'font-size': '14px'
      }
    });

    // Subscribe to all callbacks
    this.subscriptions.add(
      this.mtcaptchaService.rendered$.subscribe(() => {
        console.log('Captcha rendered');
      })
    );

    this.subscriptions.add(
      this.mtcaptchaService.verified$.subscribe((token) => {
        console.log('Captcha verified with token:', token);
      })
    );

    this.subscriptions.add(
      this.mtcaptchaService.verifyexpired$.subscribe(() => {
        console.log('Captcha verification expired');
        // Handle expiration (e.g., show message, reset form)
      })
    );

    this.subscriptions.add(
      this.mtcaptchaService.error$.subscribe((error) => {
        console.error('Captcha error:', error);
        // Handle error
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
```

## Complete Example

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MTCaptchaComponent, MTCaptchaService } from 'ng-mtcaptcha';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MTCaptchaComponent],
  template: `
    <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
      <div>
        <label>Email:</label>
        <input type="email" [(ngModel)]="email" name="email" required>
      </div>
      
      <div>
        <label>Password:</label>
        <input type="password" [(ngModel)]="password" name="password" required>
      </div>
      
      <ng-mtcaptcha 
        [sitekey]="sitekey" 
        (token)="onCaptchaToken($event)">
      </ng-mtcaptcha>
      
      <button type="submit" [disabled]="!captchaToken || loginForm.invalid">
        Login
      </button>
    </form>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  sitekey = 'YOUR_MTCAPTCHA_SITEKEY';
  captchaToken: string | null = null;
  
  constructor(private mtcaptchaService: MTCaptchaService) {}
  
  onCaptchaToken(token: string) {
    this.captchaToken = token;
    console.log('Captcha verified with token:', token);
  }
  
  onSubmit() {
    if (this.captchaToken) {
      // Send form data and token to your backend
      const loginData = {
        email: this.email,
        password: this.password,
        captchaToken: this.captchaToken
      };
      
      // Make API call to verify token and authenticate user
      console.log('Submitting login:', loginData);
    }
  }
}
```

## Backend Verification

After receiving the token from the component, you need to verify it on your backend:

```typescript
// Example backend verification (Node.js/Express)
app.post('/api/verify-captcha', async (req, res) => {
  const { token } = req.body;
  
  const response = await fetch('https://service.mtcaptcha.com/api/checktoken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      privatekey: process.env.MTCAPTCHA_PRIVATE_KEY,
      token: token
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Token is valid, proceed with your logic
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Invalid captcha' });
  }
});
```

## Browser Support

This library supports all modern browsers that Angular supports:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Version Compatibility

| ng-mtcaptcha | Angular |
|--------------|---------|
| 0.0.1        | ^21.0.0 |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](../LICENSE) file for details.

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/mtcaptcha-public/ngx-mtcaptcha/issues).

## Changelog

### 0.0.1
- Initial release
- Basic MTCaptcha component integration
- Service for token management
- Support for MTCaptcha v1 and v2 tokens
