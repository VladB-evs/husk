import { DocumentTemplate } from '../types';

export const BLANK_COMPANY_TEMPLATE: DocumentTemplate = {
  id: 'custom-company-template',
  name: 'Starter Template',
  description: 'A clean starting point. Add your company name, logo and colors in Template Studio.',
  isDefault: true,
  branding: {
    companyName: 'Your Company',
    legalEntity: '',
    contactInfo: '',
    logoUrl: '',
    logoWidth: 140,
    primaryColor: '#FF4C00',
    accentColor: '#fff7ed',
    borderColor: '#fed7aa',
    textColor: '#1e293b',
    fontFamily: 'Inter',
  },
  titlePlaceholder: 'Document title',
  subtitlePlaceholder: 'Short description of what this document is',
  metadataFields: [
    { id: '1', label: 'Document type', value: '' },
    { id: '2', label: 'Version', value: '' },
    { id: '3', label: 'Status', value: '' },
    { id: '4', label: 'Date', value: '' },
    { id: '5', label: 'Author', value: '' },
    { id: '6', label: 'Reviewer', value: '' },
  ],
  signOffConfig: {
    enabled: true,
    title: 'Sign-off',
    name: '',
    role: '',
    date: '',
    signatureUrl: '',
  },
  footerConfig: {
    enabled: true,
    leftText: 'Document title | Confidential',
    rightText: 'Page 1',
  },
  contentHtml: '', // Completely clean, no dummy filler text
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_TEMPLATES: DocumentTemplate[] = [
  BLANK_COMPANY_TEMPLATE,
];
