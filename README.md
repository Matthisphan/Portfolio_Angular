# Portfolio de Matthis PHAN

Portfolio personnel construit avec Angular 21, rendu côté serveur (SSR) et pré-rendu à la compilation.

## Prérequis

- Node.js `20.19+`, `22.12+` ou `24.x`
- npm `10+`

## Installation et développement

```bash
npm install
npm start
```

L'application est disponible sur `http://localhost:4200/` et se recharge automatiquement pendant le développement.

## Vérifications

```bash
npm test
npm run build
```

Les tests sont exécutés dans Chrome Headless. Le build de production est généré dans `dist/app/` et pré-rend la page d'accueil.

## Tester le serveur SSR

```bash
npm run build
npm run serve:ssr:app
```

Le serveur écoute par défaut sur `http://localhost:4000/`. La variable d'environnement `PORT` permet de changer ce port.

En production, renseignez les domaines publics autorisés via `NG_ALLOWED_HOSTS` (liste séparée par des virgules). Les hôtes locaux sont déjà autorisés dans `angular.json`.

## Configuration du formulaire EmailJS

Le formulaire utilise le service `service_1eim08v` et le modèle `template_7rpwy5i`. Dans le tableau de bord EmailJS, vérifiez les réglages suivants :

- **To Email** : `matthisphan.pro@gmail.com` (adresse fixe, elle ne doit pas venir du navigateur)
- **Reply-To** : `{{user_email}}`
- contenu disponible : `{{user_name}}`, `{{user_email}}`, `{{user_phone}}`, `{{subject}}` et `{{message}}`
- supprimez l'ancienne pièce jointe **Form File Attachment** de l'onglet **Attachments**
- ajoutez au contenu du mail les variables `{{attachment_count}}`, `{{attachment_links}}` et `{{attachment_expires_at}}`

Exemple de bloc à placer dans le modèle :

```text
{{#attachment_links}}
Pièces jointes : {{attachment_count}}
{{attachment_links}}
Lien valable jusqu'au : {{attachment_expires_at}}
{{/attachment_links}}
```

Ajoutez aussi le domaine public du portfolio à la liste des domaines autorisés dans EmailJS.

## Pièces jointes volumineuses sur Netlify

Netlify Functions ne reçoit jamais le fichier. Elle génère une autorisation temporaire valable une heure, puis le navigateur téléverse directement le fichier dans un bucket Cloudflare R2 privé. Après vérification du poids, du type et de la signature du fichier, EmailJS envoie uniquement un lien de téléchargement privé valable sept jours.

### 1. Créer le stockage R2

1. Créez un bucket R2 privé nommé par exemple `portfolio-contact-uploads`.
2. Créez un jeton API R2 limité à ce bucket avec les droits de lecture et d'écriture des objets.
3. Ajoutez une règle de cycle de vie supprimant `contact-staging/` après un jour et `contact-files/` après sept jours.
4. Dans les réglages CORS du bucket, adaptez puis ajoutez :

```json
[
  {
    "AllowedOrigins": [
      "https://VOTRE-SITE.netlify.app",
      "https://VOTRE-DOMAINE.fr",
      "http://localhost:8888"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 2. Configurer Netlify

Dans **Project configuration > Environment variables**, ajoutez les quatre variables listées dans `.env.example` :

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Relancez ensuite un déploiement Netlify. Pour tester les Functions localement avec les variables d'environnement configurées :

```bash
npx netlify dev
```

Le formulaire accepte jusqu'à cinq fichiers pour une taille totale maximale de 50 Mo. Cette limite est volontairement adaptée à un formulaire public afin de contenir les risques d'abus et les coûts de stockage. Il refuse les extensions exécutables, les archives et les documents avec macros. Le contrôle est effectué une première fois dans le navigateur, puis de nouveau par la Function Netlify avant la création des liens. Une seule création de lot est autorisée toutes les trois minutes par adresse IP et par domaine.

Le serveur SSR ajoute une politique CSP compatible avec EmailJS et les ressources visuelles actuelles, bloque l'intégration du site dans une iframe et désactive l'accès du navigateur à la caméra, au micro et à la géolocalisation.
