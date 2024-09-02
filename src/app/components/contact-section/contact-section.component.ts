import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import emailjs, { EmailJSResponseStatus } from '@emailjs/browser';

@Component({
  selector: 'app-contact-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact-section.component.html',
  styleUrls: ['./contact-section.component.css']
})
export class ContactSectionComponent {
  sendEmail(event: Event) {
    event.preventDefault();  // Empêche le comportement par défaut du formulaire

    // Récupère l'élément du formulaire HTML depuis l'événement de soumission
    const form = event.target as HTMLFormElement;

    // Envoie les données du formulaire via EmailJS
    emailjs.sendForm('service_1eim08v', 'template_7rpwy5i', form, 'yy6VYnnMVfZMngYHY')
      .then((result: EmailJSResponseStatus) => {
        console.log('EmailJS Response:', result.text);  // Affiche la réponse de EmailJS dans la console
        alert('Message envoyé avec succès!');  // Informe l'utilisateur du succès
      }, (error) => {
        console.error('EmailJS Error:', error.text);  // Affiche l'erreur dans la console
        alert('Erreur lors de l\'envoi du message.');  // Informe l'utilisateur de l'échec
      });
  }
}
