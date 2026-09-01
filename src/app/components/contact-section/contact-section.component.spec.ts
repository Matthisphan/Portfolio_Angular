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
