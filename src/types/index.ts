export interface BrandingConfig {
  companyName: string;
  legalEntity: string;
  contactInfo: string;
  logoUrl: string;
  logoWidth: number;
  primaryColor: string; // Used for headings, titles, accent line, table headers
  accentColor: string;  // Light tint for table header background
  borderColor: string;
  textColor: string;
  fontFamily: 'Inter' | 'System' | 'Merriweather' | 'Georgia' | 'JetBrains Mono';
}

export interface MetadataField {
  id: string;
  label: string;
  value: string;
}

export interface SignOffData {
  enabled: boolean;
  title: string;
  name: string;
  role: string;
  date: string;
  signatureUrl: string;
}

export interface FooterConfig {
  enabled: boolean;
  leftText: string;
  rightText: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  branding: BrandingConfig;
  titlePlaceholder: string;
  subtitlePlaceholder: string;
  metadataFields: MetadataField[];
  signOffConfig: SignOffData;
  footerConfig: FooterConfig;
  contentHtml: string;
  createdAt: string;
  updatedAt: string;
}

export interface HuskDocument {
  id: string;
  title: string;
  subtitle: string;
  templateId: string;
  branding: BrandingConfig;
  metadataFields: MetadataField[];
  contentHtml: string;
  signOff: SignOffData;
  footerConfig: FooterConfig;
  createdAt: string;
  updatedAt: string;
}

export interface UserSignatureProfile {
  savedSignatureUrl: string;
  defaultName: string;
  defaultRole: string;
}

export type ViewMode = 'editor' | 'templates' | 'library' | 'preview';
