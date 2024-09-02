import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from "./components/header/header.component";
import { FooterComponent } from "./components/footer/footer.component";
import { ProjectSliderComponent } from "./components/project-slider/project-slider.component";
import { HomeSectionComponent } from "./components/home-section/home-section.component";
import { ContactSectionComponent } from "./components/contact-section/contact-section.component";
import { CompetenceSectionComponent } from "./components/competence-section/competence-section.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ProjectSliderComponent, HomeSectionComponent, ContactSectionComponent, CompetenceSectionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'app';
}
