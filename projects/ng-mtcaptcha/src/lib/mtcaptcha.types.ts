export interface MTCaptchaOptions {
  sitekey: string;
  theme?: string;  // Supports any theme value (not limited to 'light'|'dark')
  widgetSize?: 'mini' | 'standard';  // Widget size: 'mini' or 'standard' (default: 'standard')
  callbackName?: string;
  customLangText?: Record<string, any> | string;  // JSON object or JSON string
  customStyle?: Record<string, any> | string;      // JSON object or JSON string
  renderedCallback?: string;
  verifiedCallback?: string;
  verifyexpiredCallback?: string;
  errorCallback?: string;
}
