import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have the portfolio title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Portfolio de Matthis PHAN');
  });

  it('should render the main portfolio sections', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#section_home')).toBeTruthy();
    expect(compiled.querySelector('#section_project')).toBeTruthy();
    expect(compiled.querySelector('#section_competence')).toBeTruthy();
    expect(compiled.querySelector('#section_contact')).toBeTruthy();
  });
});
