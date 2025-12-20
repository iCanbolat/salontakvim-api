export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  template?: string;
}

export interface SMSOptions {
  to: string;
  message: string;
  from?: string;
}

export interface TemplateVariables {
  [key: string]: any;
}
