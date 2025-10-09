# Blender-Launcher

Launcher multiplateforme moderne pour la gestion avancée de Blender.

## Stack technique
- Electron (backend, packaging)
- React (frontend)
- Node.js (logique, scripts)

## Sommaire
- [Stack technique](#stack-technique)
- [Installation & développement](#installation--développement)
- [Build & packaging](#build--packaging)
- [Outils utilisés](#outils-utilisés)
- [Logs & dépannage](#logs--dépannage)

## Stack technique
- **Electron** : Backend, packaging, API système
- **React** : Frontend moderne, composants UI
- **TypeScript** : Typage statique, robustesse
- **Webpack** : Bundling du renderer
- **Node.js** : Scripts, logique, accès fichiers
- **Concurrently, Nodemon** : Dev workflow

## Installation & développement

1. **Prérequis** : [Node.js](https://nodejs.org/) (v18+ recommandé)
2. **Cloner le repo** :
	```powershell
	git clone https://github.com/Suussonic/Blender-Launcher.git
	cd Blender-Launcher
	```
3. **Installer les dépendances** :
	```powershell
	npm install
	```
4. **Lancer en mode développement** :
	```powershell
	npm run dev
	```
	> En dev, le projet compile le main process, le renderer et lance l’app Electron (avec rechargement si configuré).

## Build & packaging

Cette section décrit en détail les commandes de build et de packaging disponibles, les artefacts produits et des conseils de dépannage — spécialement pour Windows.

### Commandes principales
- Installer les dépendances :
	```powershell
	npm install
	```

- Build complet (renderer + main) :
	```powershell
	npm run build
	```
	Ce que fait cette commande :
	  - `npm run build:renderer` : bundle le renderer (React) via Webpack en mode production. Sortie : `dist/renderer/renderer.js` et `dist/renderer/index.html`.
	  - `npm run build:main` : compile le main process TypeScript (`tsc`) en `dist/main`, puis copie les assets runtime (preload, tray, public) dans `dist/` via `scripts/copy_dist_assets.js`.

	Fichiers importants générés par le build :
	  - `dist/main/main.js` (main process compilé)
	  - `dist/preload.js` (preload exposant l'API sécurisée)
	  - `dist/renderer/renderer.js` et `dist/renderer/index.html` (UI)
	  - `dist/tray/*` (popup tray HTML/JS/CSS)

### Packaging Windows — options
Le projet propose plusieurs workflows de packaging pour Windows. Choisissez selon vos besoins (test rapide, distribution portable, build signée, etc.).

1) Packager + ZIP portable (recommandé, pas besoin d'Admin)

Cette option utilise `electron-packager` puis crée un ZIP portable contenant l'application complète :
```powershell
npm run package:win:portable
```
Résultat attendu :
- `release/blender-launcher-win32-x64/` (dossier unpacked)
- `release/blender-launcher-win32-x64-portable.zip` (archive portable)

Pourquoi l'utiliser :
- Ne nécessite pas d'`exécuter la commande en mode administrateur`.
- Évite un problème fréquent d'`electron-builder` (voir point suivant) lié à l'extraction d'un helper binaire qui crée des symlinks.

2) electron-builder (zip / portable targets)

Commandes :
- Zip (exécute le build avant packaging) :
```powershell
npm run package:win:zip
```
- (Optionnel) electron-builder portable target :
```powershell
npm run package:win:portable
```

Important — erreur d'extraction 7-zip / symlink :

Lors de l'utilisation d'`electron-builder`, l'outil télécharge parfois des archives auxiliaires (par ex. `winCodeSign-*.7z`). Quand 7-Zip extrait ces archives, elles peuvent contenir des liens symboliques. Sur certaines installations Windows, la création de symlinks nécessite des privilèges élevés et l'extraction échoue avec l'erreur :

`"ERROR: Cannot create symbolic link : Le client ne dispose pas d'un privilège nécessaire"`

Solutions :
- Exécutez la commande dans une session PowerShell élevée (Ouvrir PowerShell en tant qu'administrateur).
- Ou préférez l'option `package:win:portable` (packager + zip) qui contourne electron-builder et produit une archive portable sans extraction problématique.

3) electron-packager seul (staging rapide)

Pour tests rapides sans empaqueter en zip :
```powershell
npm run package:packager
```
Cela crée le dossier `release/Blender Launcher-win32-x64/` (ou sim.) contenant l'app unpacked.

### Metadata Windows intégrées automatiquement

Les builds produits par les scripts de packaging intègrent désormais automatiquement les metadata Windows (CompanyName, FileDescription, ProductName) afin que Windows affiche le bon éditeur au lieu de "GitHub, Inc.".

- Les valeurs par défaut sont définies dans `package.json` sous `build.win32metadata`.
- Les scripts de packaging (`scripts/package_with_packager.js` et `scripts/package_portable_packager.js`) lisent ces métadonnées et transmettent `win32metadata` à `electron-packager`.

Pour modifier l'éditeur affiché, éditez `package.json` et changez `build.win32metadata.CompanyName` puis ré-exécutez le packaging :

```powershell
npm run package:packager
```

Ou pour produire la version portable (zip) :

```powershell
npm run package:win:portable
```

Si tu veux modifier les métadonnées pour des builds CI seulement, tu peux aussi passer des variables d'environnement et les lire dans les scripts.

### Nettoyage
- Nettoyer les artefacts :
```powershell
npm run clean
```
Ceci supprime `dist/` et `release/`.

## Logs & dépannage

Où chercher les logs utiles lorsque l'app packagée se comporte mal :

- Main process logs :
  - `%APPDATA%\Blender Launcher\bl-launcher-main.log` ou `C:\Users\<you>\AppData\Local\Blender Launcher\bl-launcher-main.log` selon l'installation.
- Tray process logs :
  - `%APPDATA%\Blender Launcher\bl-launcher-tray.log`

Conseils pratiques :
- Toujours lancer l'EXE depuis le dossier `release/...` (ou extraire le ZIP portable) pour garantir la présence de tous les fichiers `dist/` et d'autres ressources. Déplacer uniquement l'EXE sans ses ressources cause des écrans bloqués (préparation infinie) ou des erreurs "fichier introuvable".
- Si l'interface reste bloquée au démarrage : regardez `bl-launcher-main.log` pour trouver des erreurs d'initialisation (preload non trouvé, handlers IPC manquants, etc.).
- Pour le menu tray : démarrez avec `TRAY_DEBUG=1` (ou activez l'option correspondante dans la config) afin d'ouvrir les DevTools du popup tray et inspecter la console.

Dépannage courant et solutions :
- Erreur electron-builder 7z extraction (sym-link) : lancer la commande en Admin PowerShell ou utiliser `package:win:portable`.
- Erreurs TypeScript / bundle à la compilation : installez les devDependencies et types manquants (ex. `@types/react`, `@types/react-dom`, et autres loaders) avant d'exécuter `npm run build`.

## Outils utilisés

- **Electron** : https://www.electronjs.org/
- **React** : https://react.dev/
- **TypeScript** : https://www.typescriptlang.org/
- **Webpack** : https://webpack.js.org/
- **Electron Packager** : https://github.com/electron/electron-packager
- **Electron Builder** : https://www.electron.build/


## Notes
- Si vous voulez que je rende `npm run package:win:portable` ré-exécutable (build + package) automatiquement, je peux le faire — mais il faudra résoudre les erreurs TypeScript / bundle présentes sur certaines machines (ajout de dev types / loaders). Dites-moi si je dois :
  1) Restaurer `package:win:portable` pour lancer le build à chaque fois, et corriger les erreurs de build (installer `@types/*`, corriger `tsconfig.json`).
  2) Laisser le script tel quel (packager + zip) et exiger un `npm run build` manuel avant packaging.

---

L'intégration Discord Rich Presence est incluse.
