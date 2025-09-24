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
  // Tuned so the weapon sits bottom-right and fully visible in desktop mode
  desktopHoldOffset: { type: 'vec3', default: {x: 0.22, y: -0.14, z: -0.5} },
      desktopHoldRotation: { type: 'vec3', default: {x: 0, y: 0, z: 0} },
      autoDesktopPickup: { type: 'boolean', default: true },
      autoPickupDistance: { type: 'number', default: 3.0 },
      debug: { type: 'boolean', default: false }
    },
    init: function(){
      this.holdingHand = null;
      this.desktopHeld = false;
      this._savedDyn = null;
      this._prevParent = null;
      this._onTriggerDown = ()=> this.fire();
      this._onGripDown = ()=> this.fire(); // fallback if trigger events absent
      this._onSqueeze = ()=> this.fire();
      this._onGrabStart = (e)=>{
        this.holdingHand = e.detail && e.detail.handEl;
        if (this.holdingHand){
          if (this.data.debug) console.log('[Gun] grab-start from', this.holdingHand.id || this.holdingHand.tagName);
          this.holdingHand.addEventListener('triggerdown', this._onTriggerDown);
          this.holdingHand.addEventListener('selectstart', this._onTriggerDown);
          // Fallback bindings
          this.holdingHand.addEventListener('gripdown', this._onGripDown);
          this.holdingHand.addEventListener('squeezestart', this._onSqueeze);
        }
      };
      this._onGrabEnd = (e)=>{
        if (this.holdingHand){
          this.holdingHand.removeEventListener('triggerdown', this._onTriggerDown);
          this.holdingHand.removeEventListener('selectstart', this._onTriggerDown);
          this.holdingHand.removeEventListener('gripdown', this._onGripDown);
          this.holdingHand.removeEventListener('squeezestart', this._onSqueeze);
        }
        if (this.data.debug) console.log('[Gun] grab-end');
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
          // Try normal pickup, then extend reach if needed
          if (!this._desktopTryPickup()) {
            this._desktopTryPickup(this.data.autoPickupDistance);
          }
        }
      };
      this._onMouseDown = (ev)=>{
        if (ev.button !== 0) return; // left click
        if (this.desktopHeld) { this.fire(); this._hudFire(); }
      };
      this._onKeyFire = (ev)=>{
        if (ev.code !== 'KeyF') return;
        if (this.desktopHeld) { this.fire(); this._hudFire(); }
      };
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('mousedown', this._onMouseDown);
      window.addEventListener('keydown', this._onKeyFire);

      // If model loads later, re-ensure visibility
      // Fallback mesh in case model is not yet visible
      const modelEl = this.el.querySelector('[gltf-model]');
      this._fallback = document.createElement('a-box');
      this._fallback.setAttribute('class', 'gun-fallback');
      this._fallback.setAttribute('depth', 0.3);
      this._fallback.setAttribute('height', 0.12);
      this._fallback.setAttribute('width', 0.18);
      this._fallback.setAttribute('position', '0 0 0');
      this._fallback.setAttribute('material', 'color: #ffffff; emissive: #888');
      this.el.appendChild(this._fallback);
      const hideFallback = ()=>{ if (this._fallback) { this._fallback.setAttribute('visible', 'false'); } };
      if (modelEl){ modelEl.addEventListener('model-loaded', ()=>{ this._ensureVisible(); hideFallback(); }); }

      // Auto-pickup on desktop shortly after load to ensure visibility
      setTimeout(()=>{
        const scene = this.el.sceneEl;
        const inVR = scene && scene.is('vr-mode');
        if (!inVR && this.data.autoDesktopPickup && !this.desktopHeld) {
          this._desktopTryPickup(this.data.autoPickupDistance);
        }
      }, 300);

      // Firing sound element (lightweight, reused)
      this._fireSound = document.createElement('audio');
      this._fireSound.src = 'https://actions.google.com/sounds/v1/impacts/wood_plank_flicks.ogg';
      this._fireSound.preload = 'auto';
      this._fireSound.volume = 0.4;
      document.body.appendChild(this._fireSound);

      // Reticle hide/show depending on VR
      const sceneEl = this.el.sceneEl;
      if (sceneEl){
        sceneEl.addEventListener('enter-vr', ()=>{ const r=document.getElementById('reticle'); if(r) r.setAttribute('visible','false'); });
        sceneEl.addEventListener('exit-vr', ()=>{ const r=document.getElementById('reticle'); if(r) r.setAttribute('visible','true'); });
      }
    },
    _hudFire: function(){
      const dbg = document.getElementById('dbg');
      if (dbg) dbg.textContent = (dbg.textContent + ' | tir').trim();
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
      window.removeEventListener('keydown', this._onKeyFire);
      if (this._fireSound && this._fireSound.parentNode) this._fireSound.parentNode.removeChild(this._fireSound);
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
    _desktopTryPickup: function(maxDist){
      if (this.desktopHeld) return true;
      const allow = (maxDist || this.data.pickupDistance);
      if (this._distanceToHead() > allow) return false;
      const head = this._getHead();
      if (!head) return false;
      // Save physics config and disable physics
      const dyn = this.el.getAttribute('dynamic-body');
      this._savedDyn = dyn ? Object.assign({}, dyn) : null;
      try { this.el.removeAttribute('dynamic-body'); } catch(e){}
      try { this.el.removeAttribute('kinematic-body'); } catch(e){}

      // Reparent to head and set local transform
      this._prevParent = this.el.parentNode;
      head.appendChild(this.el);
      this.el.setAttribute('position', `${this.data.desktopHoldOffset.x} ${this.data.desktopHoldOffset.y} ${this.data.desktopHoldOffset.z}`);
      this.el.setAttribute('rotation', `${this.data.desktopHoldRotation.x} ${this.data.desktopHoldRotation.y} ${this.data.desktopHoldRotation.z}`);
      // Make sure it's visible and not culled
      this._ensureVisible();
      this.desktopHeld = true;
      // Notify HUD
      const dbg = document.getElementById('dbg');
      if (dbg) dbg.textContent = (dbg.textContent + ' | [Desktop] Arme prise').trim();
      return true;
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
    _ensureVisible: function(){
      // Ensure the gun and its children are visible and not frustum-culled when parented to camera
      const o = this.el.object3D;
      if (!o) return;
      o.visible = true;
      o.traverse((n)=>{ n.visible = true; n.frustumCulled = false; });
    },
    fire: function(){
      // Only allow fire in VR if the gun is grabbed (holdingHand) or in desktop-held mode
      const scene = this.el.sceneEl;
      const inVR = scene && scene.is('vr-mode');
      if (inVR && !this.holdingHand) {
        // Not currently held; ignore to avoid accidental shots
        return;
      }
      if (this.data.debug) console.log('[Gun] FIRE (inVR=' + inVR + ', desktopHeld=' + this.desktopHeld + ')');
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
  p.setAttribute('material', 'emissive: #ffaa00; emissiveIntensity: 0.6');
      const sceneRoot = this.el.sceneEl || document.querySelector('a-scene');
      sceneRoot.appendChild(p);
      p.setAttribute('dynamic-body', 'shape: sphere; mass: 0.1; linearDamping: 0.01; angularDamping: 0.01');
      // Set initial velocity once the body is ready
      const speed = this.data.speed;
      p.addEventListener('body-loaded', ()=>{
        try { p.body.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed); } catch(e){}
      });
      // Fallback re-apply velocity shortly after spawn (some browsers delay body-loaded)
      setTimeout(()=>{
        if (p.body && p.body.velocity && p.body.velocity.almostZero && p.body.velocity.lengthSquared && p.body.velocity.lengthSquared() < 0.01) {
          try { p.body.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed); } catch(e){}
        } else if (p.body && p.body.velocity) {
          // If zero length by manual inspection
          if (Math.abs(p.body.velocity.x)+Math.abs(p.body.velocity.y)+Math.abs(p.body.velocity.z) < 0.0001) {
            try { p.body.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed); } catch(e){}
          }
        }
      }, 120);

      // Cleanup after life
      setTimeout(()=>{ if (p && p.parentNode) p.parentNode.removeChild(p); }, this.data.life * 1000);

      // Simple muzzle flash
      const flash = document.createElement('a-sphere');
      flash.setAttribute('radius', 0.03);
      flash.setAttribute('color', '#fff');
      flash.setAttribute('material', 'emissive: #ffffff; emissiveIntensity: 1.2');
      flash.setAttribute('position', `${muzzleWorld.x} ${muzzleWorld.y} ${muzzleWorld.z}`);
  const sceneRoot2 = this.el.sceneEl || document.querySelector('a-scene');
  sceneRoot2.appendChild(flash);
      setTimeout(()=>{ if (flash && flash.parentNode) flash.parentNode.removeChild(flash); }, 80);
      if (this._fireSound){ try { this._fireSound.currentTime = 0; this._fireSound.play().catch(()=>{});} catch(e){} }
    }
  });
})();
