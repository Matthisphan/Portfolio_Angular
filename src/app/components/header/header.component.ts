// Importation des modules nécessaires d'Angular
import { Component } from '@angular/core';


@Component({
  selector: 'app-header',
  standalone: true,        // Indique que ce composant est autonome (standalone), ce qui signifie qu'il peut fonctionner indépendamment
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})

// Définition de la classe HeaderComponent qui implémente l'interface OnInit d'Angular
export class HeaderComponent {
  activeIndex: number = 0;

  setActive(index: number) {
    this.activeIndex = index;
  }
}
