import { Component, HostListener, OnDestroy } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import emailjs from '@emailjs/browser';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';

type SubmissionStatus = 'idle' | 'success' | 'error';
type FilePreviewKind = 'image' | 'pdf' | 'word' | 'excel';

interface PreparedUpload {
  uploadUrl: string;
  key: string;
  ticket: string;
  contentType: string;
}

interface UploadPreparation {
  uploads: PreparedUpload[];
}

interface CompletedUpload {
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
  fileSize: number;
}

interface UploadCompletion {
  files: CompletedUpload[];
}

interface SelectedAttachment {
  id: string;
  file: File;
  extension: string;
  kind: FilePreviewKind;
  previewUrl?: string;
}

interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

class ContactUploadError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILE_COUNT = 5;
const OFFICE_INDEX_SIZE = 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'jpg',
  'jpeg',
  'png',
  'webp',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function countryFlag(country: CountryCode): string {
  return [...country]
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397))
    .join('');
}

function createCountryOptions(): CountryOption[] {
  const displayNames = new Intl.DisplayNames(['fr'], { type: 'region' });

  return getCountries()
    .map((code) => ({
      code,
      name: displayNames.of(code) || code,
      dialCode: `+${getCountryCallingCode(code)}`,
      flag: countryFlag(code),
    }))
    .sort((first, second) => {
      if (first.code === 'FR') {
        return -1;
      }
      if (second.code === 'FR') {
        return 1;
      }
      return first.name.localeCompare(second.name, 'fr');
    });
}

@Component({
  selector: 'app-contact-section',
  imports: [FormsModule],
  templateUrl: './contact-section.component.html',
  styleUrl: './contact-section.component.css',
})
export class ContactSectionComponent implements OnDestroy {
  readonly recipientEmail = 'matthisphan.pro@gmail.com';
  readonly maxFileSizeLabel = '50 Mo';
  readonly maxFileCount = MAX_FILE_COUNT;
  readonly countries = createCountryOptions();

  isSending = false;
  isDragging = false;
  uploadProgress = 0;
  selectedAttachments: SelectedAttachment[] = [];
  fileError = '';
  phoneCountry: CountryCode = 'FR';
  phoneNational = '';
  phoneError = '';
  status: SubmissionStatus = 'idle';
  statusMessage = '';

  private completedUploads: CompletedUpload[] = [];
  private uploadedSelectionKey = '';

  get selectedFileNames(): string[] {
    return this.selectedAttachments.map(({ file }) => file.name);
  }

  get selectedFilesSize(): string {
    const size = this.selectedAttachments.reduce(
      (total, attachment) => total + attachment.file.size,
      0,
    );
    return this.formatFileSize(size);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.addAttachments(Array.from(input.files ?? []));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.isSending) {
      this.isDragging = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDragging = false;

    if (!this.isSending) {
      await this.addAttachments(Array.from(event.dataTransfer?.files ?? []));
    }
  }

  @HostListener('document:paste', ['$event'])
  async onPaste(event: ClipboardEvent): Promise<void> {
    if (this.isSending) {
      return;
    }

    const pastedFiles = Array.from(event.clipboardData?.files ?? []);
    if (!pastedFiles.length) {
      return;
    }

    event.preventDefault();
    const timestamp = Date.now();
    const normalizedFiles = pastedFiles.map((file, index) =>
      this.normalizePastedFile(file, timestamp, index),
    );
    await this.addAttachments(normalizedFiles);
  }

  openFilePicker(input: HTMLInputElement): void {
    if (!this.isSending) {
      input.click();
    }
  }

  onDropZoneKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openFilePicker(input);
    }
  }

  removeAttachment(id: string): void {
    const attachment = this.selectedAttachments.find(
      (candidate) => candidate.id === id,
    );
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }

    this.selectedAttachments = this.selectedAttachments.filter(
      (candidate) => candidate.id !== id,
    );
    this.fileError = '';
    this.invalidateCompletedUploads();
  }

  onPhoneChanged(): void {
    this.phoneError = this.validatePhoneNumber();
  }

  onPhoneCountryChanged(country: CountryCode): void {
    this.phoneCountry = country;
    this.onPhoneChanged();
  }

  async sendEmail(
    event: Event,
    contactForm: NgForm,
    attachmentInput: HTMLInputElement,
  ): Promise<void> {
    event.preventDefault();
    this.phoneError = this.validatePhoneNumber();

    if (contactForm.invalid || this.phoneError) {
      contactForm.control.markAllAsTouched();
      this.setStatus(
        'error',
        'Vérifiez les champs obligatoires avant l’envoi.',
      );
      return;
    }

    const form = event.target as HTMLFormElement;
    const honeypot = new FormData(form).get('website');

    if (typeof honeypot === 'string' && honeypot.trim()) {
      this.resetForm(contactForm, attachmentInput);
      this.setStatus('success', 'Votre message a bien été envoyé.');
      return;
    }

    const attachments = this.selectedAttachments.map(({ file }) => file);
    this.fileError = await this.validateAttachments(attachments);

    if (this.fileError) {
      this.setStatus('error', this.fileError);
      return;
    }

    this.setIdentityValues(form);
    this.isSending = true;
    this.uploadProgress = 0;
    this.setStatus(
      'idle',
      attachments.length ? 'Préparation du téléversement sécurisé…' : '',
    );

    try {
      if (attachments.length) {
        const selectionKey = this.getSelectionKey(attachments);
        let uploadedFiles = this.completedUploads;

        if (
          this.uploadedSelectionKey !== selectionKey ||
          uploadedFiles.length !== attachments.length
        ) {
          uploadedFiles = await this.uploadAttachments(attachments);
          this.completedUploads = uploadedFiles;
          this.uploadedSelectionKey = selectionKey;
        }

        this.setAttachmentValues(form, uploadedFiles);
        this.setStatus('idle', 'Fichiers sécurisés. Envoi du message…');
      } else {
        this.clearAttachmentValues(form);
      }

      await emailjs.send(
        'service_u01na3e',
        'template_7rpwy5i',
        this.buildEmailParameters(form),
        {
          publicKey: 'yy6VYnnMVfZMngYHY',
          blockHeadless: true,
          limitRate: {
            id: 'portfolio-contact-form',
            throttle: 60_000,
          },
        },
      );

      this.resetForm(contactForm, attachmentInput);
      this.setStatus(
        'success',
        'Message envoyé. Je vous répondrai dès que possible.',
      );
    } catch (error: unknown) {
      console.error('Échec de l’envoi du formulaire :', error);
      this.setStatus('error', this.getSendErrorMessage(error));
    } finally {
      this.isSending = false;
      this.uploadProgress = 0;
    }
  }

  ngOnDestroy(): void {
    this.revokePreviewUrls();
  }

  private async addAttachments(files: File[]): Promise<void> {
    if (!files.length) {
      return;
    }

    const existingFingerprints = new Set(
      this.selectedAttachments.map(({ file }) => this.fileFingerprint(file)),
    );
    const uniqueFiles = files.filter((file) => {
      const fingerprint = this.fileFingerprint(file);
      if (existingFingerprints.has(fingerprint)) {
        return false;
      }
      existingFingerprints.add(fingerprint);
      return true;
    });

    if (!uniqueFiles.length) {
      this.fileError = 'Ces fichiers sont déjà dans la sélection.';
      return;
    }

    const combinedFiles = [
      ...this.selectedAttachments.map(({ file }) => file),
      ...uniqueFiles,
    ];
    const error = await this.validateAttachments(combinedFiles);

    if (error) {
      this.fileError = error;
      return;
    }

    this.selectedAttachments = [
      ...this.selectedAttachments,
      ...uniqueFiles.map((file) => this.createSelectedAttachment(file)),
    ];
    this.fileError = '';
    this.invalidateCompletedUploads();
  }

  private createSelectedAttachment(file: File): SelectedAttachment {
    const extension = this.getExtension(file.name);
    const kind = this.getPreviewKind(extension);

    return {
      id: `${this.fileFingerprint(file)}:${crypto.randomUUID()}`,
      file,
      extension,
      kind,
      previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
    };
  }

  private normalizePastedFile(
    file: File,
    timestamp: number,
    index: number,
  ): File {
    if (this.getExtension(file.name)) {
      return file;
    }

    const extension =
      Object.entries(MIME_TYPE_BY_EXTENSION).find(
        ([candidate, mimeType]) =>
          candidate !== 'jpeg' && mimeType === file.type,
      )?.[0] || 'bin';

    return new File(
      [file],
      `fichier-colle-${timestamp}-${index + 1}.${extension}`,
      {
        type: file.type,
        lastModified: file.lastModified,
      },
    );
  }

  private getPreviewKind(extension: string): FilePreviewKind {
    if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      return 'image';
    }
    if (extension === 'pdf') {
      return 'pdf';
    }
    if (extension === 'doc' || extension === 'docx') {
      return 'word';
    }
    return 'excel';
  }

  private async uploadAttachments(files: File[]): Promise<CompletedUpload[]> {
    const preparation = await this.postJson<UploadPreparation>(
      '/api/contact-upload/create',
      {
        files: files.map((file) => ({
          fileName: file.name,
          fileSize: file.size,
          contentType:
            file.type || MIME_TYPE_BY_EXTENSION[this.getExtension(file.name)],
        })),
      },
    );

    if (preparation.uploads.length !== files.length) {
      throw new ContactUploadError(
        502,
        'Le stockage n’a pas préparé tous les fichiers.',
      );
    }

    const totalSize = files.reduce((total, file) => total + file.size, 0);
    let uploadedSize = 0;

    for (const [index, file] of files.entries()) {
      const preparedUpload = preparation.uploads[index];
      await this.putFile(
        preparedUpload.uploadUrl,
        file,
        preparedUpload.contentType,
        uploadedSize,
        totalSize,
      );
      uploadedSize += file.size;
    }

    this.uploadProgress = 100;

    const completion = await this.postJson<UploadCompletion>(
      '/api/contact-upload/complete',
      {
        uploads: preparation.uploads.map(({ key, ticket }) => ({ key, ticket })),
      },
    );

    if (completion.files.length !== files.length) {
      throw new ContactUploadError(
        502,
        'Le stockage n’a pas validé tous les fichiers.',
      );
    }

    return completion.files;
  }

  private setIdentityValues(form: HTMLFormElement): void {
    const firstName = this.getFormValue(form, 'user_first_name');
    const lastName = this.getFormValue(form, 'user_last_name');

    this.setFormValue(
      form,
      'user_name',
      [firstName, lastName].filter(Boolean).join(' '),
    );
    this.setFormValue(form, 'user_phone', this.getInternationalPhone());
  }

  private buildEmailParameters(form: HTMLFormElement): Record<string, string> {
    const parameterNames = [
      'user_name',
      'user_first_name',
      'user_last_name',
      'user_email',
      'user_phone',
      'phone_country',
      'subject',
      'message',
      'attachment_url',
      'attachment_links',
      'attachment_count',
      'attachment_name',
      'attachment_size',
      'attachment_expires_at',
    ];

    return Object.fromEntries(
      parameterNames.map((name) => [name, this.getFormValue(form, name)]),
    );
  }

  private setAttachmentValues(
    form: HTMLFormElement,
    uploadedFiles: CompletedUpload[],
  ): void {
    const links = uploadedFiles
      .map(
        (file, index) =>
          `${index + 1}. ${file.fileName} (${this.formatFileSize(file.fileSize)})\n${file.downloadUrl}`,
      )
      .join('\n\n');
    const firstFile = uploadedFiles[0];
    const totalSize = uploadedFiles.reduce(
      (total, file) => total + file.fileSize,
      0,
    );

    this.setFormValue(form, 'attachment_links', links);
    this.setFormValue(form, 'attachment_count', String(uploadedFiles.length));
    this.setFormValue(form, 'attachment_url', firstFile.downloadUrl);
    this.setFormValue(
      form,
      'attachment_name',
      uploadedFiles.map((file) => file.fileName).join(', '),
    );
    this.setFormValue(
      form,
      'attachment_size',
      this.formatFileSize(totalSize),
    );
    this.setFormValue(form, 'attachment_expires_at', firstFile.expiresAt);
  }

  private async validateAttachments(files: File[]): Promise<string> {
    if (files.length > MAX_FILE_COUNT) {
      return `Vous pouvez sélectionner ${MAX_FILE_COUNT} fichiers maximum.`;
    }

    const totalSize = files.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_FILE_SIZE) {
      return `La taille totale des fichiers dépasse ${this.maxFileSizeLabel}.`;
    }

    for (const file of files) {
      const error = await this.validateAttachment(file);
      if (error) {
        return `${file.name} : ${error}`;
      }
    }

    return '';
  }

  private async postJson<T>(url: string, body: object): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ContactUploadError(
        0,
        'Impossible de joindre les Functions Netlify. Vérifiez votre connexion.',
      );
    }

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      if (response.status === 404) {
        throw new ContactUploadError(
          404,
          'Les Functions Netlify sont introuvables. En local, lancez « npx netlify dev » au lieu de « npm start ».',
        );
      }

      throw new ContactUploadError(
        response.status,
        payload.error || 'Le service de téléversement est indisponible.',
      );
    }

    return payload as T;
  }

  private putFile(
    url: string,
    file: File,
    contentType: string,
    uploadedSize: number,
    totalSize: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', url);
      request.setRequestHeader('Content-Type', contentType);

      request.upload.addEventListener('progress', (progressEvent) => {
        if (progressEvent.lengthComputable) {
          this.uploadProgress = Math.min(
            99,
            Math.round(
              ((uploadedSize + progressEvent.loaded) / totalSize) * 100,
            ),
          );
          this.setStatus(
            'idle',
            `Téléversement sécurisé : ${this.uploadProgress} %`,
          );
        }
      });

      request.addEventListener('load', () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
          return;
        }

        reject(
          new ContactUploadError(
            request.status,
            'Le stockage a refusé le téléversement du fichier.',
          ),
        );
      });
      request.addEventListener('error', () => {
        reject(
          new ContactUploadError(
            0,
            'Le téléversement a été interrompu. Vérifiez votre connexion.',
          ),
        );
      });
      request.addEventListener('timeout', () => {
        reject(
          new ContactUploadError(
            408,
            'Le téléversement a pris trop de temps.',
          ),
        );
      });
      request.timeout = 60 * 60 * 1000;
      request.send(file);
    });
  }

  private async validateAttachment(file: File): Promise<string> {
    const extension = this.getExtension(file.name);

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return 'Format refusé. Utilisez un PDF, Word, Excel, JPG, PNG ou WebP.';
    }

    if (file.size === 0) {
      return 'Le fichier sélectionné est vide.';
    }

    if (file.size > MAX_FILE_SIZE) {
      return `Le fichier dépasse la taille maximale de ${this.maxFileSizeLabel}.`;
    }

    if (
      file.type &&
      file.type !== 'application/octet-stream' &&
      !ALLOWED_MIME_TYPES.has(file.type)
    ) {
      return 'Le type réel du fichier ne correspond pas à un format autorisé.';
    }

    const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const archiveIndex =
      extension === 'docx' || extension === 'xlsx'
        ? new Uint8Array(
            await file
              .slice(Math.max(0, file.size - OFFICE_INDEX_SIZE))
              .arrayBuffer(),
          )
        : undefined;

    if (!this.hasValidSignature(extension, header, archiveIndex)) {
      return 'Le contenu du fichier ne correspond pas à son extension.';
    }

    return '';
  }

  private hasValidSignature(
    extension: string,
    header: Uint8Array,
    archiveIndex?: Uint8Array,
  ): boolean {
    const startsWith = (...signature: number[]) =>
      signature.every((byte, index) => header[index] === byte);

    switch (extension) {
      case 'pdf':
        return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
      case 'jpg':
      case 'jpeg':
        return startsWith(0xff, 0xd8, 0xff);
      case 'png':
        return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
      case 'webp':
        return (
          startsWith(0x52, 0x49, 0x46, 0x46) &&
          header[8] === 0x57 &&
          header[9] === 0x45 &&
          header[10] === 0x42 &&
          header[11] === 0x50
        );
      case 'doc':
      case 'xls':
        return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
      case 'docx':
      case 'xlsx': {
        if (!startsWith(0x50, 0x4b, 0x03, 0x04) || !archiveIndex) {
          return false;
        }

        const decodedIndex = new TextDecoder('latin1').decode(archiveIndex);
        return extension === 'docx'
          ? decodedIndex.includes('word/') &&
              decodedIndex.includes('[Content_Types].xml')
          : decodedIndex.includes('xl/') &&
              decodedIndex.includes('[Content_Types].xml');
      }
      default:
        return false;
    }
  }

  private validatePhoneNumber(): string {
    const value = this.phoneNational.trim();
    if (!value) {
      return '';
    }

    const phoneNumber = parsePhoneNumberFromString(value, this.phoneCountry);
    return phoneNumber?.isValid()
      ? ''
      : 'Indiquez un numéro de téléphone valide pour ce pays.';
  }

  private getInternationalPhone(): string {
    const value = this.phoneNational.trim();
    if (!value) {
      return '';
    }

    return (
      parsePhoneNumberFromString(value, this.phoneCountry)?.number.toString() ||
      ''
    );
  }

  private getSendErrorMessage(error: unknown): string {
    if (error instanceof ContactUploadError) {
      if (error.status === 429) {
        return 'Trop de tentatives ont été effectuées. Réessayez dans quelques minutes.';
      }

      if (error.status === 503) {
        return 'Le stockage sécurisé n’est pas encore configuré sur Netlify.';
      }

      return error.message;
    }

    const status =
      typeof error === 'object' && error && 'status' in error
        ? Number(error.status)
        : 0;

    if (status === 400 || status === 422) {
      return `Le modèle EmailJS a refusé le message (code ${status}). Retirez l’ancienne pièce jointe configurée dans EmailJS.`;
    }

    if (status === 401 || status === 403) {
      return `EmailJS a refusé l’accès (code ${status}). Vérifiez le domaine autorisé et la clé publique.`;
    }

    if (status === 429) {
      return 'Un message vient déjà d’être envoyé. Réessayez dans une minute.';
    }

    if (status >= 500) {
      return `Le service d’e-mail est momentanément indisponible (code ${status}).`;
    }

    return status
      ? `L’envoi de l’e-mail a échoué (code ${status}).`
      : 'L’envoi a échoué. Vérifiez votre connexion ou écrivez directement à l’adresse indiquée.';
  }

  private getExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() ?? '';
  }

  private formatFileSize(size: number): string {
    if (size === 0) {
      return '0 Ko';
    }
    if (size < 1024 * 1024) {
      return `${Math.ceil(size / 1024)} Ko`;
    }

    return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
  }

  private fileFingerprint(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  private getSelectionKey(files: File[]): string {
    return files.map((file) => this.fileFingerprint(file)).join('|');
  }

  private getFormValue(form: HTMLFormElement, name: string): string {
    const input = form.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;
    return input?.value.trim() || '';
  }

  private setFormValue(
    form: HTMLFormElement,
    name: string,
    value: string,
  ): void {
    const input = form.elements.namedItem(name) as HTMLInputElement | null;
    if (input) {
      input.value = value;
    }
  }

  private clearAttachmentValues(form: HTMLFormElement): void {
    for (const name of [
      'attachment_url',
      'attachment_links',
      'attachment_count',
      'attachment_name',
      'attachment_size',
      'attachment_expires_at',
    ]) {
      this.setFormValue(form, name, '');
    }
  }

  private resetForm(
    contactForm: NgForm,
    attachmentInput: HTMLInputElement,
  ): void {
    contactForm.resetForm();
    attachmentInput.value = '';
    this.phoneCountry = 'FR';
    this.phoneNational = '';
    this.phoneError = '';
    this.fileError = '';
    this.revokePreviewUrls();
    this.selectedAttachments = [];
    this.invalidateCompletedUploads();
  }

  private revokePreviewUrls(): void {
    for (const attachment of this.selectedAttachments) {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    }
  }

  private invalidateCompletedUploads(): void {
    this.completedUploads = [];
    this.uploadedSelectionKey = '';
  }

  private setStatus(status: SubmissionStatus, message: string): void {
    this.status = status;
    this.statusMessage = message;
  }
}
