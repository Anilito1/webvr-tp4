# TP4 WebVR (A-Frame)

Exercice 1: scène A-Frame avec objets, lumières (ambient + directionnelle), ombres, et un rig VR avec mouvement au joystick gauche et rotation au joystick droit.

## Démarrage rapide

Ouvrez `index.html` dans un serveur local (obligatoire pour certains assets/contrôleurs). Sur Windows PowerShell :

```powershell
# Si vous avez Python 3
python -m http.server -d . 5500
# puis ouvrez http://localhost:5500/index.html
```

Alternatives :
- VS Code: extension "Live Server"
- Node: `npx http-server -p 5500 .`

## Contrôles
- Joystick gauche : avancer/reculer/gauche/droite
- Joystick droit : rotation de la vue
- Clavier (fallback) : ZQSD / WASD + flèches gauche/droite pour pivoter
- VR Grabbing : maintenez Grip ou Trigger pour saisir un objet proche, relâchez pour le lâcher (l’objet tombe avec la gravité)
- Souris : look-controls (quand non VR)

## Notes techniques
- `thumbstick-move-rotate` est un composant custom (voir `src/controls.js`).
- Ombres activées sur la lumière directionnelle et les objets (`shadow`).
- Renderer : `physicallyCorrectLights: true` pour un éclairage plus réaliste.
- Physique : `aframe-physics-system` (cannon-es). Le sol a `static-body` et les objets grabbables ont `dynamic-body`.
- Grabbing : `controller-grab` (voir `src/grabber.js`) créé un verrou "lock" pendant la saisie, puis l’objet redevient libre à la relâche.
- Contrôleurs : on utilise `laser-controls` (plus simple/fiable multi-headsets). Si besoin de modèles de main, on peut réactiver `oculus-touch-controls`.
- Dépannage : ajoutez `?safe=1` à l’URL pour désactiver ombres/fog/HUD si la page gèle à l’entrée VR.

## Prochaines étapes (TP)
- Ex. 2 : matériaux/Textures et interactions.
- Ex. 3 : arme VR (tir de projectiles).

## Exercice 3 — Arme VR
- L’arme est un entity `#gun` avec le composant `vr-gun`.
- Saisie: via `controller-grab` (grip/trigger/select/squeeze). L’arme suit la main (cinématique) et redevient dynamique à la relâche.
- Tir: quand elle est tenue, appuyer sur la gâchette (ou select) du contrôleur pour créer une balle (`a-sphere`) avec `dynamic-body` et une vitesse initiale.
- Paramètres:
  - `vr-gun="speed: 10; projectileRadius: 0.05; life: 4"`
  - `muzzleOffset` décale la sortie du canon (par défaut le -Z de l’arme).

### Ajouter un vrai modèle 3D (optionnel)
Fichier recommandé: `.glb` (glTF binaire)
- Taille < 5 Mo si possible (optimisé), matériaux PBR simples.
- Unités: mètres. Orientation: avant = -Z, haut = +Y. Origine au niveau de la poignée.
- Idéal: un empty/locator nommé `muzzle` en bout de canon (avant -Z) pour le tir.

Intégration:
1. Placez `gun.glb` dans un dossier `assets/`.
2. Dans `index.html`, ajoutez dans `<a-assets>`:
	`<a-asset-item id="gunModel" src="./assets/gun.glb"></a-asset-item>`
3. Remplacez le contenu de `#gun` par:
	`<a-entity gltf-model="#gunModel" scale="1 1 1"></a-entity>`
4. Ajustez `muzzleOffset` si pas de locator.
- Ex. 4 : optimisation et post-process.
