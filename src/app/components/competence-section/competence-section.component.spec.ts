import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompetenceSectionComponent } from './competence-section.component';

describe('CompetenceSectionComponent', () => {
  let component: CompetenceSectionComponent;
  let fixture: ComponentFixture<CompetenceSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompetenceSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompetenceSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
