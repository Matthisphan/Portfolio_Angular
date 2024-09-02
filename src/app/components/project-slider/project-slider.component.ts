// Importation des modules et interfaces nécessaires
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';  // Module pour les directives communes comme *ngFor, *ngIf
import { IonicModule } from '@ionic/angular';  // Module Ionic pour utiliser les composants comme ion-icon

// Définition de l'interface Slide qui structure chaque diapositive avec un titre, une description et une URL d'image
interface Slide {
  title: string;
  description: string;
  imageUrl: string;
  lien: string;
}

// Déclaration du composant Angular
@Component({
  selector: 'app-project-slider',  // Sélecteur pour inclure ce composant dans un template, par exemple <app-project-slider>
  standalone: true,  // Indique que ce composant est autonome et n'a pas besoin d'être déclaré dans un module
  imports: [CommonModule, IonicModule],  // Importation des modules nécessaires pour le fonctionnement du composant
  templateUrl: './project-slider.component.html',  // Chemin vers le fichier HTML associé à ce composant
  styleUrls: ['./project-slider.component.css']  // Chemin vers le fichier CSS associé à ce composant
})
export class ProjectSliderComponent {
  // Tableau de diapositives, chaque élément est un objet de type Slide
  slides: Slide[] = [
    {
      title: "Pixel War",
      description: "Découvrez une refonte du célèbre r/place la plateforme collaborative où chaque pixel compte ! Créez, collaborez, et rivalisez avec d'autres utilisateurs pour façonner une toile numérique en constante évolution.",
      imageUrl: "projets/rplace.jpg",
      lien: "https://github.com/Matthisphan/Rplace-api"
    },
    {
      title: "Pétrarque",
      description: "Site web développé pour apporter aux professionnels des solutions novatrices dans l’accompagnement des personnes fragilisées par l’âge, le handicap ou de la petite enfance.",
      imageUrl: "projets/petrarque.png",
      lien: "https://petrarque.org"
    },
    {
      title: "Une Belle Agence",
      description: "Le partenaire idéal pour une communication percutante. Créative et expérimentée, cette agence accompagne ses clients dans la définition et la réalisation de leur stratégie de communication.",
      imageUrl: "projets/uba.webp",
      lien: "https://unebelleagence.fr"
    },
    {
      title: "Tarna",
      description: "Une entreprise innovante spécialisée dans la création de modèles 3D, idéale pour donner vie à l'univers visuel de votre marque !",
      imageUrl: "projets/tarna.png",
      lien: "https://tarna.tech"
    },
    {
      title: "Burn.py",
      description: "Plongez dans un monde 2D en pixel art où votre seule mission est de survivre le plus longtemps possible !",
      imageUrl: "projets/burn.png",
      lien: "https://github.com/Matthisphan/Burn"
    },
    {
      title: "Cooldown",
      description: "Développement d'un réseaux social similaire à X. Partagez, publiez et interagissez comme jamais auparavant !",
      imageUrl: "projets/cooldown.jpg",
      lien: "https://github.com/Matthisphan/Cooldown"
    }
  ];

  // Méthode pour retourner l'image de fond d'une diapositive sous forme de chaîne de caractères
  getBackgroundImage(slide: Slide) {
    return `url('${slide.imageUrl}')`;
  }

  // Méthode pour passer à la diapositive suivante
  nextSlide() {
    // Retire la première diapositive du tableau et la place à la fin (rotation directe)
    this.slides.push(this.slides.shift()!);
  }

  // Méthode pour revenir à la diapositive précédente
  prevSlide() {
    // Retire la dernière diapositive du tableau et la place au début (rotation inverse)
    this.slides.unshift(this.slides.pop()!);
  }

  // Méthode pour mettre l'élément cliqué au début du tableau et déplacer l'élément en position 0 à la fin
  moveSlideToFront(slide: Slide) {
    const index = this.slides.indexOf(slide);

    console.log(index);

    if (index > 0) {
      // Retirer l'élément cliqué de sa position actuelle et le placer en première position
      const [clickedSlide] = this.slides.splice(index, 1);

      // Déplacer l'élément en position 0 (avant le changement) à la fin du tableau
      const firstSlide = this.slides.shift();

      // Ajouter l'élément cliqué en première position
      this.slides.unshift(clickedSlide);

      // Ajouter l'ancien premier élément à la fin du tableau
      if (firstSlide) {
        this.slides.push(firstSlide);
      }
    }
  }

  goToLink(url: string) {
    window.open(url, '_blank');
  }
}

