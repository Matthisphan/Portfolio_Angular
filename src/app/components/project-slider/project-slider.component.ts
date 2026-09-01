import { Component } from '@angular/core';

interface Slide {
  title: string;
  description: string;
  imageUrl: string;
  lien: string;
}

@Component({
  selector: 'app-project-slider',
  templateUrl: './project-slider.component.html',
  styleUrl: './project-slider.component.css'
})
export class ProjectSliderComponent {
  readonly slides: Slide[] = [
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
      description: "Développement d'un réseau social similaire à X. Partagez, publiez et interagissez comme jamais auparavant !",
      imageUrl: "projets/cooldown.jpg",
      lien: "https://github.com/Matthisphan/Cooldown"
    }
  ];

  getBackgroundImage(slide: Slide): string {
    return `url('${slide.imageUrl}')`;
  }

  nextSlide(): void {
    this.slides.push(this.slides.shift()!);
  }

  prevSlide(): void {
    this.slides.unshift(this.slides.pop()!);
  }

  moveSlideToFront(slide: Slide): void {
    const index = this.slides.indexOf(slide);

    if (index > 0) {
      const [clickedSlide] = this.slides.splice(index, 1);
      const firstSlide = this.slides.shift();
      this.slides.unshift(clickedSlide);
      if (firstSlide) {
        this.slides.push(firstSlide);
      }
    }
  }

  goToLink(event: Event, url: string): void {
    event.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

