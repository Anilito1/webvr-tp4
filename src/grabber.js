// Simple grab-and-release component using physics (aframe-physics-system)
// Quest 3 friendly: grip/trigger/select to grab. While held, object becomes kinematic and
// follows the hand pose. On release, it regains dynamic body and falls with gravity.
(function(){
  const tmpV3 = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpM = new THREE.Matrix4();

  AFRAME.registerComponent('controller-grab', {
    schema: {
      hand: { type: 'string', default: 'right' },
  radius: { type: 'number', default: 0.35 } // proximity sphere radius
    },
    init: function(){
      this.grabbed = null;        // grabbed entity
      this.origBody = null;       // remember original dynamic-body config
      this.offsetPos = new THREE.Vector3();
      this.offsetQuat = new THREE.Quaternion();
  this._grabbables = Array.from(this.el.sceneEl.querySelectorAll('.grabbable'));
  this._lastScan = 0;

      // Collider helper
      this.sphere = document.createElement('a-sphere');
      this.sphere.setAttribute('radius', this.data.radius);
      this.sphere.setAttribute('opacity', 0);
      this.sphere.setAttribute('visible', false);
      this.el.appendChild(this.sphere);

  // Button bindings: grip/trigger/select
      this._onGrip = ()=> this.tryGrab();
      this._onGripUp = ()=> this.release();
      this._onTrigger = ()=> this.tryGrab();
      this._onTriggerUp = ()=> this.release();
      this._onSelect = ()=> this.tryGrab();
      this._onSelectEnd = ()=> this.release();
      // Hover feedback using raycaster-intersection
      this._hovered = null;
      this.el.addEventListener('raycaster-intersection', (e)=>{
        const it = e.detail.els && e.detail.els[0];
        if (it && it.classList && it.classList.contains('grabbable')) {
          if (this._hovered && this._hovered !== it) this._clearHighlight(this._hovered);
          this._hovered = it; this._setHighlight(it, true);
        }
      });
      this.el.addEventListener('raycaster-intersection-cleared', (e)=>{
        if (this._hovered) { this._clearHighlight(this._hovered); this._hovered = null; }
      });

      this.el.addEventListener('gripdown', this._onGrip);
      this.el.addEventListener('gripup', this._onGripUp);
      this.el.addEventListener('triggerdown', this._onTrigger);
      this.el.addEventListener('triggerup', this._onTriggerUp);
      this.el.addEventListener('squeezestart', this._onGrip);
      this.el.addEventListener('squeezeend', this._onGripUp);
      this.el.addEventListener('selectstart', this._onSelect);
      this.el.addEventListener('selectend', this._onSelectEnd);
    },
    remove: function(){
      this.el.removeEventListener('gripdown', this._onGrip);
      this.el.removeEventListener('gripup', this._onGripUp);
      this.el.removeEventListener('triggerdown', this._onTrigger);
      this.el.removeEventListener('triggerup', this._onTriggerUp);
      this.el.removeEventListener('squeezestart', this._onGrip);
      this.el.removeEventListener('squeezeend', this._onGripUp);
      this.el.removeEventListener('selectstart', this._onSelect);
      this.el.removeEventListener('selectend', this._onSelectEnd);
    },
    tick: function(time, dt){
  // If holding an object, update its transform to match hand (keeping initial offset)
      if(!this.grabbed) return;
      const hand = this.el.object3D;
      const obj = this.grabbed.object3D;
  // World pose of hand
  const handPos = hand.getWorldPosition(tmpV3);
  const handQuat = hand.getWorldQuaternion(tmpQ);
  // Apply offset captured at grab time: obj = hand * offset
  obj.position.copy(handPos).add(this.offsetPos.clone().applyQuaternion(handQuat));
  obj.quaternion.copy(handQuat).multiply(this.offsetQuat);
      obj.updateMatrixWorld();
    },
    tryGrab: function(){
      if(this.grabbed) return;
      const handObj = this.el.object3D;
      const handPos = handObj.getWorldPosition(tmpV3);

      // Occasionally rescan grabbables (in case scene changed)
      const now = performance.now();
      if (now - this._lastScan > 1000) {
        this._grabbables = Array.from(this.el.sceneEl.querySelectorAll('.grabbable'));
        this._lastScan = now;
      }

  // If raycaster hits a grabbable, prefer it
  let best = this._hovered && this._hovered.classList.contains('grabbable') ? this._hovered : null;

  // Find closest grabbable within radius (near grab)
      const grabbables = this._grabbables;
  let bestDist2 = Infinity;
      for(const g of grabbables){
        const obj = g.object3D;
        if(!obj) continue;
        const p = obj.getWorldPosition(new THREE.Vector3());
        const d2 = handPos.distanceToSquared(p);
        if(d2 < (this.data.radius*this.data.radius) && d2 < bestDist2){
          best = g; bestDist2 = d2;
        }
      }
      if(!best) return;

  // Remember original dynamic-body config (if any)
  this.origBody = best.getAttribute('dynamic-body');

  // Compute initial offset between hand and object
  const hand = this.el.object3D;
  const obj = best.object3D;
  const handQuat = hand.getWorldQuaternion(new THREE.Quaternion());
  const invHandQuat = handQuat.clone().invert();
  const objPos = obj.getWorldPosition(new THREE.Vector3());
  const objQuat = obj.getWorldQuaternion(new THREE.Quaternion());
  this.offsetPos.copy(objPos.sub(hand.getWorldPosition(new THREE.Vector3()))).applyQuaternion(invHandQuat);
  this.offsetQuat.copy(invHandQuat.multiply(objQuat));

  // Switch to kinematic to follow hand cleanly
  if (best.hasAttribute('dynamic-body')) best.removeAttribute('dynamic-body');
  best.setAttribute('kinematic-body', '');
      this.grabbed = best;
    },
    release: function(){
      if(!this.grabbed) return;
      const g = this.grabbed;
      // Return to dynamic body so it falls
      g.removeAttribute('kinematic-body');
      if (this.origBody) {
        g.setAttribute('dynamic-body', this.origBody);
      } else {
        g.setAttribute('dynamic-body', 'mass: 1');
      }
      this.grabbed = null;
      this.origBody = null;
    }
    ,_setHighlight: function(el, on){
      if(!el) return;
      if (on) {
        if (!el.dataset.origColor) el.dataset.origColor = el.getAttribute('color');
        el.setAttribute('color', '#FFFF88');
      } else {
        el.setAttribute('color', el.dataset.origColor || '#FFFFFF');
      }
    }
    ,_clearHighlight: function(el){ this._setHighlight(el, false); }
  });
})();
