import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactSectionComponent } from './contact-section.component';

describe('ContactSectionComponent', () => {
  let component: ContactSectionComponent;
  let fixture: ComponentFixture<ContactSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContactSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('demande le prénom, le nom et propose tous les indicatifs pays', () => {
    const firstName: HTMLInputElement = fixture.nativeElement.querySelector(
      '[name="user_first_name"]',
    );
    const lastName: HTMLInputElement = fixture.nativeElement.querySelector(
      '[name="user_last_name"]',
    );
    const country: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[name="phone_country"]',
    );

    expect(firstName.required).toBeTrue();
    expect(lastName.required).toBeTrue();
    expect(country.options.length).toBeGreaterThan(200);
    expect(component.phoneCountry).toBe('FR');
  });

  it('valide le numéro selon le pays sélectionné', () => {
    component.phoneCountry = 'FR';
    component.phoneNational = '06 12 34 56 78';
    component.onPhoneChanged();
    expect(component.phoneError).toBe('');

    component.phoneNational = '123';
    component.onPhoneChanged();
    expect(component.phoneError).toContain('numéro de téléphone valide');
  });

  it('affiche le destinataire et prépare un lien au lieu de joindre le fichier à EmailJS', () => {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    const attachment: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type="file"]',
    );

    expect(component.recipientEmail).toBe('matthisphan.pro@gmail.com');
    expect(component.maxFileSizeLabel).toBe('50 Mo');
    expect(attachment.name).toBe('');
    expect(attachment.multiple).toBeTrue();
    expect(form.querySelector('[name="attachment_url"]')).toBeTruthy();
    expect(form.querySelector('[name="attachment_links"]')).toBeTruthy();
    expect(form.querySelector('[name="attachment_count"]')).toBeTruthy();
    expect(form.querySelector('[name="attachment_name"]')).toBeTruthy();
    expect(attachment.accept).toContain('.pdf');
    expect(attachment.accept).toContain('.docx');
    expect(attachment.accept).toContain('.xlsx');
    expect(attachment.accept).toContain('.png');
    expect(attachment.accept).not.toContain('.exe');
    expect(attachment.accept).not.toContain('.zip');
  });

  it('accepte un PDF dont la signature correspond à son extension', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])],
      'document.pdf',
      { type: 'application/pdf' },
    );
    Object.defineProperty(input, 'files', { value: [file] });

    await component.onFileSelected({ target: input } as unknown as Event);

    expect(component.fileError).toBe('');
    expect(component.selectedFileNames).toEqual(['document.pdf']);
  });

  it('refuse un fichier dont le contenu ne correspond pas à son extension', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    const file = new File(
      [new Uint8Array([0x4d, 0x5a, 0x90, 0x00])],
      'faux-document.pdf',
      { type: 'application/pdf' },
    );
    Object.defineProperty(input, 'files', { value: [file] });

    await component.onFileSelected({ target: input } as unknown as Event);

    expect(component.fileError).toContain('contenu du fichier');
    expect(component.selectedFileNames).toEqual([]);
  });

  it('refuse un fichier qui dépasse 50 Mo avant tout téléversement', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
      'document.pdf',
      { type: 'application/pdf' },
    );
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 });
    Object.defineProperty(input, 'files', { value: [file] });

    await component.onFileSelected({ target: input } as unknown as Event);

    expect(component.fileError).toContain('50 Mo');
    expect(component.selectedFileNames).toEqual([]);
  });

  it('accepte plusieurs fichiers autorisés', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    const files = ['premier.pdf', 'second.pdf'].map(
      (name) =>
        new File(
          [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])],
          name,
          { type: 'application/pdf' },
        ),
    );
    Object.defineProperty(input, 'files', { value: files });

    await component.onFileSelected({ target: input } as unknown as Event);

    expect(component.fileError).toBe('');
    expect(component.selectedFileNames).toEqual(['premier.pdf', 'second.pdf']);
  });

  it('accepte le glisser-déposer et permet de retirer un fichier', async () => {
    const file = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])],
      'depose.pdf',
      { type: 'application/pdf' },
    );
    const preventDefault = jasmine.createSpy('preventDefault');

    await component.onDrop({
      preventDefault,
      dataTransfer: { files: [file] },
    } as unknown as DragEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.selectedFileNames).toEqual(['depose.pdf']);

    component.removeAttachment(component.selectedAttachments[0].id);
    expect(component.selectedFileNames).toEqual([]);
  });

  it('accepte une image collée et crée son aperçu', async () => {
    const file = new File(
      [
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
        ]),
      ],
      'capture.png',
      { type: 'image/png' },
    );
    const preventDefault = jasmine.createSpy('preventDefault');

    await component.onPaste({
      preventDefault,
      clipboardData: { files: [file] },
    } as unknown as ClipboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.selectedFileNames).toEqual(['capture.png']);
    expect(component.selectedAttachments[0].previewUrl).toContain('blob:');
  });

  it('refuse plus de cinq fichiers', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    const files = Array.from(
      { length: 6 },
      (_, index) =>
        new File([new Uint8Array([0x25])], `document-${index}.pdf`, {
          type: 'application/pdf',
        }),
    );
    Object.defineProperty(input, 'files', { value: files });

    await component.onFileSelected({ target: input } as unknown as Event);

    expect(component.fileError).toContain('5 fichiers maximum');
    expect(component.selectedFileNames).toEqual([]);
  });
});
