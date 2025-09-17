// Simple VR gun component: can be grabbed (with controller-grab on hands)
// When held, pulling trigger on the holding hand fires a physics projectile.
(function(){
  const tmpV3 = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();

  AFRAME.registerComponent('vr-gun', {
    schema: {
      projectileColor: { type: 'color', default: '#ffee88' },
      projectileRadius: { type: 'number', default: 0.05 },
      muzzleOffset: { type: 'vec3', default: {x: 0, y: 0, z: -0.4} },
      speed: { type: 'number', default: 10 },
      life: { type: 'number', default: 4 }
    },
    init: function(){
      this.holdingHand = null;
      this._onTriggerDown = ()=> this.fire();
      this._onGrabStart = (e)=>{
        this.holdingHand = e.detail && e.detail.handEl;
        if (this.holdingHand){
          this.holdingHand.addEventListener('triggerdown', this._onTriggerDown);
          this.holdingHand.addEventListener('selectstart', this._onTriggerDown);
        }
      };
      this._onGrabEnd = (e)=>{
        if (this.holdingHand){
          this.holdingHand.removeEventListener('triggerdown', this._onTriggerDown);
          this.holdingHand.removeEventListener('selectstart', this._onTriggerDown);
        }
        this.holdingHand = null;
      };
      this.el.addEventListener('grab-start', this._onGrabStart);
      this.el.addEventListener('grab-end', this._onGrabEnd);
    },
    remove: function(){
      this.el.removeEventListener('grab-start', this._onGrabStart);
      this.el.removeEventListener('grab-end', this._onGrabEnd);
      if (this.holdingHand){
        this.holdingHand.removeEventListener('triggerdown', this._onTriggerDown);
        this.holdingHand.removeEventListener('selectstart', this._onTriggerDown);
      }
    },
    fire: function(){
      // Muzzle world pose
      const obj = this.el.object3D;
      const muzzleLocal = new THREE.Vector3(this.data.muzzleOffset.x, this.data.muzzleOffset.y, this.data.muzzleOffset.z);
      const muzzleWorld = obj.localToWorld(muzzleLocal.clone());
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(obj.getWorldQuaternion(tmpQ)).normalize();

      // Create projectile
      const p = document.createElement('a-sphere');
      p.setAttribute('radius', this.data.projectileRadius);
      p.setAttribute('color', this.data.projectileColor);
      p.setAttribute('position', `${muzzleWorld.x} ${muzzleWorld.y} ${muzzleWorld.z}`);
      p.setAttribute('shadow', 'cast: true; receive: false');
      p.setAttribute('dynamic-body', 'shape: sphere; mass: 0.1; linearDamping: 0.01; angularDamping: 0.01');
      this.el.sceneEl.appendChild(p);

      // Apply initial velocity
      const body = p.body; // may not exist immediately; defer
      const applyVel = ()=>{
        if (p.body){
          const speed = this.data.speed;
          p.body.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed);
        } else {
          requestAnimationFrame(applyVel);
        }
      };
      requestAnimationFrame(applyVel);

      // Cleanup after life
      setTimeout(()=>{ if (p && p.parentNode) p.parentNode.removeChild(p); }, this.data.life * 1000);
    }
  });
})();
