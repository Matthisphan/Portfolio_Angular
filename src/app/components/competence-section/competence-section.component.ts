import { Component } from '@angular/core';

type SkillGenre = 'dev' | 'design' | 'divers';

interface Skill {
  title: string;
  imageUrl: string;
  genre: SkillGenre;
}

@Component({
  selector: 'app-competence-section',
  templateUrl: './competence-section.component.html',
  styleUrl: './competence-section.component.css'
})
export class CompetenceSectionComponent {
  readonly skills: Skill[] = [
    {
      title: "HTML",
      imageUrl: "competence/html.png",
      genre: "dev"
    },
    {
      title: "CSS",
      imageUrl: "competence/css.png",
      genre: "dev"
    },
    {
      title: "JavaScript",
      imageUrl: "competence/js.png",
      genre: "dev"
    },
    {
      title: "PHP",
      imageUrl: "competence/php.png",
      genre: "dev"
    },
    {
      title: "Python",
      imageUrl: "competence/python.png",
      genre: "dev"
    },
    {
      title: "React",
      imageUrl: "competence/react.png",
      genre: "dev"
    },
    {
      title: "Angular",
      imageUrl: "competence/angular.png",
      genre: "dev"
    },
    {
      title: "Symfony",
      imageUrl: "competence/symfony.png",
      genre: "dev"
    },
    {
      title: "Figma",
      imageUrl: "competence/figma.png",
      genre: "design"
    },
    {
      title: "Adobe Suite",
      imageUrl: "competence/adobe.png",
      genre: "design"
    },
    {
      title: "Microsoft Office",
      imageUrl: "competence/office.png",
      genre: "divers"
    }
  ];

  selectedGenre: SkillGenre | 'all' = 'all';

  filterSkills(genre: SkillGenre | 'all'): void {
    this.selectedGenre = genre;
  }

  get filteredSkills(): Skill[] {
    if (this.selectedGenre === 'all') {
      return this.skills;
    }
    return this.skills.filter(skill => skill.genre === this.selectedGenre);
  }
}
