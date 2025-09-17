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
      life: { type: 'number', default: 4 },
      // Desktop (non-VR) handling
      pickupDistance: { type: 'number', default: 1.5 },
      desktopHoldOffset: { type: 'vec3', default: {x: 0.25, y: -0.15, z: -0.5} },
      desktopHoldRotation: { type: 'vec3', default: {x: 0, y: 90, z: 0} }
    },
    init: function(){
      this.holdingHand = null;
      this.desktopHeld = false;
      this._savedDyn = null;
      this._prevParent = null;
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

      // Desktop input
      this._onKeyDown = (ev)=>{
        if (ev.code !== 'KeyE') return;
        const scene = this.el.sceneEl;
        const inVR = scene && scene.is('vr-mode');
        if (inVR) return; // handled by controllers
        if (this.desktopHeld) {
          this._desktopDrop();
        } else {
          this._desktopTryPickup();
        }
      };
      this._onMouseDown = (ev)=>{
        if (ev.button !== 0) return; // left click
        const scene = this.el.sceneEl;
        const inVR = scene && scene.is('vr-mode');
        if (inVR) return;
        if (this.desktopHeld) this.fire();
      };
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('mousedown', this._onMouseDown);
    },
    remove: function(){
      this.el.removeEventListener('grab-start', this._onGrabStart);
      this.el.removeEventListener('grab-end', this._onGrabEnd);
      if (this.holdingHand){
        this.holdingHand.removeEventListener('triggerdown', this._onTriggerDown);
        this.holdingHand.removeEventListener('selectstart', this._onTriggerDown);
      }
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('mousedown', this._onMouseDown);
    },
    _getHead: function(){
      // Prefer #head if present, else scene camera entity
      const head = document.getElementById('head');
      if (head) return head;
      const cam = this.el.sceneEl && this.el.sceneEl.camera;
      return cam && cam.el ? cam.el : null;
    },
    _distanceToHead: function(){
      const head = this._getHead();
      if (!head) return Infinity;
      const pGun = new THREE.Vector3();
      const pHead = new THREE.Vector3();
      this.el.object3D.getWorldPosition(pGun);
      head.object3D.getWorldPosition(pHead);
      return pGun.distanceTo(pHead);
    },
    _desktopTryPickup: function(){
      if (this.desktopHeld) return;
      if (this._distanceToHead() > this.data.pickupDistance) return;
      const head = this._getHead();
      if (!head) return;
      // Save physics config and disable physics
      const dyn = this.el.getAttribute('dynamic-body');
      this._savedDyn = dyn ? Object.assign({}, dyn) : null;
      if (this.el.body) { try { this.el.removeAttribute('dynamic-body'); } catch(e){} }

      // Reparent to head and set local transform
      this._prevParent = this.el.parentNode;
      head.appendChild(this.el);
      this.el.setAttribute('position', `${this.data.desktopHoldOffset.x} ${this.data.desktopHoldOffset.y} ${this.data.desktopHoldOffset.z}`);
      this.el.setAttribute('rotation', `${this.data.desktopHoldRotation.x} ${this.data.desktopHoldRotation.y} ${this.data.desktopHoldRotation.z}`);
      this.desktopHeld = true;
    },
    _desktopDrop: function(){
      if (!this.desktopHeld) return;
      const head = this._getHead();
      const scene = this.el.sceneEl;
      if (!head || !scene) return;

      // Compute drop position slightly in front of camera
      const headObj = head.object3D;
      const pos = new THREE.Vector3();
      const dir = new THREE.Vector3(0,0,-1);
      headObj.getWorldPosition(pos);
      dir.applyQuaternion(headObj.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const dropPos = pos.clone().add(dir.multiplyScalar(0.8));
      dropPos.y -= 0.1;

      // Reparent back to previous parent or scene
      const parent = this._prevParent && this._prevParent.isConnected ? this._prevParent : scene;
      parent.appendChild(this.el);
      this.el.setAttribute('position', `${dropPos.x} ${dropPos.y} ${dropPos.z}`);
      // Face roughly same yaw as head
      const euler = new THREE.Euler().setFromQuaternion(headObj.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
      const yawDeg = THREE.MathUtils.radToDeg(euler.y);
      this.el.setAttribute('rotation', `0 ${yawDeg} 0`);

      // Restore physics
      if (this._savedDyn){
        // Re-apply saved dynamic-body config
        this.el.setAttribute('dynamic-body', this._savedDyn);
      } else {
        // Fallback
        this.el.setAttribute('dynamic-body', 'shape: box; mass: 0.5');
      }
      this.desktopHeld = false;
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
