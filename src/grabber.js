// Simple grab-and-release component using physics (aframe-physics-system)
// Works with Quest 3 (oculus-touch-controls). Grip/Trigger to grab.
(function(){
  const tmpV3 = new THREE.Vector3();

  AFRAME.registerComponent('controller-grab', {
    schema: {
      hand: { type: 'string', default: 'right' },
      radius: { type: 'number', default: 0.3 } // proximity sphere radius
    },
    init: function(){
      this.grabbed = null;
      this.constraint = null;
      this.physics = this.el.sceneEl.systems['physics'];

      // Collider helper
      this.sphere = document.createElement('a-sphere');
      this.sphere.setAttribute('radius', this.data.radius);
      this.sphere.setAttribute('opacity', 0);
      this.sphere.setAttribute('visible', false);
      this.el.appendChild(this.sphere);

      // Button bindings: grip or trigger
      this._onGrip = (e)=> this.tryGrab();
      this._onGripUp = (e)=> this.release();
      this._onTrigger = (e)=> this.tryGrab();
      this._onTriggerUp = (e)=> this.release();

      this.el.addEventListener('gripdown', this._onGrip);
      this.el.addEventListener('gripup', this._onGripUp);
      this.el.addEventListener('triggerdown', this._onTrigger);
      this.el.addEventListener('triggerup', this._onTriggerUp);
    },
    remove: function(){
      this.el.removeEventListener('gripdown', this._onGrip);
      this.el.removeEventListener('gripup', this._onGripUp);
      this.el.removeEventListener('triggerdown', this._onTrigger);
      this.el.removeEventListener('triggerup', this._onTriggerUp);
    },
    tick: function(){
      // no-op; grab uses immediate overlap check on button press
    },
    tryGrab: function(){
      if(this.grabbed) return;
      const handObj = this.el.object3D;
      const handPos = handObj.getWorldPosition(tmpV3);

      // Find closest grabbable within radius
      const grabbables = this.el.sceneEl.querySelectorAll('.grabbable');
      let best = null, bestDist2 = Infinity;
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

      // Ensure dynamic body
      if(!best.hasAttribute('dynamic-body')){
        best.setAttribute('dynamic-body', 'mass: 1');
      }

      // Create constraint to hand
      const constraintId = `__grab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      best.setAttribute('constraint', {
        target: `#${this.el.id}`,
        type: 'lock'
      });
      this.grabbed = best;
      this.constraint = constraintId;

      // Zero velocities to avoid jitter
      const body = best.body;
      if(body){
        body.velocity.set(0,0,0);
        body.angularVelocity.set(0,0,0);
      }
    },
    release: function(){
      if(!this.grabbed) return;
      try {
        this.grabbed.removeAttribute('constraint');
      } catch (e) {}
      this.grabbed = null;
      this.constraint = null;
    }
  });
})();
