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

## Prochaines étapes (TP)
- Ex. 2 : matériaux/Textures et interactions.
- Ex. 3 : téléportation / navmesh.
- Ex. 4 : optimisation et post-process.
