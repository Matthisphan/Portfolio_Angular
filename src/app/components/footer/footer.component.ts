import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';  // Module pour les directives communes comme *ngFor, *ngIf
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {

}
