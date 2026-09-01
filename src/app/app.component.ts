import { Component } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { ProjectSliderComponent } from './components/project-slider/project-slider.component';
import { HomeSectionComponent } from './components/home-section/home-section.component';
import { ContactSectionComponent } from './components/contact-section/contact-section.component';
import { CompetenceSectionComponent } from './components/competence-section/competence-section.component';

@Component({
  selector: 'app-root',
  imports: [
    HeaderComponent,
    FooterComponent,
    ProjectSliderComponent,
    HomeSectionComponent,
    ContactSectionComponent,
    CompetenceSectionComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly title = 'Portfolio de Matthis PHAN';
}
