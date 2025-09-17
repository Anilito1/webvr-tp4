// Thumbstick movement (left) + rotation (right) for A-Frame rig
// Also provides desktop fallback: ZQSD/ESDF or WASD + mouse look
(function(){
  const TWO_PI = Math.PI * 2;
  AFRAME.registerComponent('thumbstick-move-rotate', {
    schema: {
      moveSpeed: { type: 'number', default: 2.0 },
      rotateSpeed: { type: 'number', default: 80 } // degrees per second
    },
    init: function(){
      this.dir = new THREE.Vector3();
      this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
  this.yaw = this.el.object3D.rotation.y || 0;
      this.keys = {};

      this.leftAxis = { x: 0, y: 0 };
      this.rightAxis = { x: 0, y: 0 };
  this.buttonA = false;
  this.dbg = document.getElementById('dbg');
  this._gpPoll = true; // enable gamepad polling fallback
  this._pollTimer = 0;
  this._dbgTimer = 0;
  this.eventCounts = { left: 0, right: 0, connL: 0, connR: 0 };
  this.leftEl = null;
  this.rightEl = null;

      const el = this.el;

      // Attach listeners to specific controller entities for reliable VR input
      this._bindHand = (handEl, side) => {
        if (!handEl || handEl._thumbstickBound) return;
        const onThumb = (e) => {
          const d = e.detail || {};
          const v = { x: (d.x ?? 0), y: (d.y ?? 0) };
          if (side === 'left') this.leftAxis = v; else this.rightAxis = v;
          if (side === 'left') this.eventCounts.left++; else this.eventCounts.right++;
        };
        const onAxis = (e) => {
          const axis = (e.detail && e.detail.axis) || [0, 0];
          const v = { x: axis[0] || 0, y: axis[1] || 0 };
          if (side === 'left') this.leftAxis = v; else this.rightAxis = v;
          if (side === 'left') this.eventCounts.left++; else this.eventCounts.right++;
        };
        const onButtonChanged = (e) => {
          if (e.detail && typeof e.detail.pressed === 'boolean' && e.detail.id === 0) {
            // id 0 often maps to primary (A) on Oculus
            this.buttonA = e.detail.pressed;
          }
        };
        const onConnected = () => {
          if (side === 'left') this.eventCounts.connL++; else this.eventCounts.connR++;
        };
        handEl.addEventListener('thumbstickmoved', onThumb);
        handEl.addEventListener('axismove', onAxis);
        handEl.addEventListener('abuttonchanged', onButtonChanged);
        handEl.addEventListener('controllerconnected', onConnected);
        handEl._thumbstickBound = true;
        if (side === 'left') this.leftEl = handEl; else this.rightEl = handEl;
      };

      // Try binding immediately if hands already exist
      this._bindHand(el.querySelector('#leftHand'), 'left');
      this._bindHand(el.querySelector('#rightHand'), 'right');

      // If controllers appear later, bind on attach
      el.addEventListener('child-attached', (e) => {
        const child = e.detail && e.detail.el;
        if (!child || !child.id) return;
        if (child.id === 'leftHand') this._bindHand(child, 'left');
        if (child.id === 'rightHand') this._bindHand(child, 'right');
      });

      // thumbstickmoved is emited by tracked-controls-based components
      el.addEventListener('thumbstickmoved', (e)=>{
        // Route by hand
        const hand = e.srcElement && e.srcElement.id || '';
        if(hand.includes('left')) this.leftAxis = e.detail;
        if(hand.includes('right')) this.rightAxis = e.detail;
      });
      // Generic axismove as fallback (some devices emit this)
      el.addEventListener('axismove', (e)=>{
        const hand = e.srcElement && e.srcElement.id || '';
        const [x, y] = e.detail.axis || [0,0];
        if(hand.includes('left')) this.leftAxis = { x, y };
        if(hand.includes('right')) this.rightAxis = { x, y };
      });

      // Desktop fallback
      window.addEventListener('keydown', (e)=>{ this.keys[e.code] = true; });
      window.addEventListener('keyup', (e)=>{ this.keys[e.code] = false; });
    },
    tick: function(time, dt){
      const delta = (dt || 0) / 1000;
      if(!delta) return;
      // Gamepad polling fallback (Quest 3 via WebXR) — throttled and only in VR mode
      this._pollTimer += delta;
      const scene = this.el.sceneEl;
      const inVR = scene && scene.is('vr-mode');
      if (inVR && this._gpPoll && this._pollTimer >= 0.05 && navigator.getGamepads) {
        this._pollTimer = 0;
        const pads = navigator.getGamepads();
        for (let i = 0; i < pads.length; i++) {
          const gp = pads[i];
          if (!gp || !gp.connected) continue;
          const id = (gp.id || '').toLowerCase();
          if (id.includes('oculus') || id.includes('quest') || id.includes('meta')) {
            const ax = gp.axes || [];
            if (ax.length >= 2) {
              this.leftAxis = { x: ax[0] || 0, y: ax[1] || 0 };
            }
            if (ax.length >= 3) {
              // Try index 2, fallback index 3
              const rx = (typeof ax[2] === 'number') ? ax[2] : (ax[3] || 0);
              this.rightAxis = { x: rx || 0, y: this.rightAxis.y || 0 };
            }
          }
        }
      }

      // Extra fallback: read axes from controller components if exposed
      const readAxesFromComponent = (handEl, side) => {
        if (!handEl) return;
        const tc = handEl.components && (handEl.components['oculus-touch-controls'] || handEl.components['tracked-controls']);
        const gp = tc && tc.controller && tc.controller.gamepad;
        if (gp && gp.axes && gp.axes.length) {
          const ax = gp.axes;
          if (side === 'left' && ax.length >= 2) {
            this.leftAxis = { x: ax[0] || 0, y: ax[1] || 0 };
          } else if (side === 'right' && ax.length >= 3) {
            // RX often at index 2; if not, try 3
            const rx = (typeof ax[2] === 'number') ? ax[2] : (ax[3] || 0);
            this.rightAxis = { x: rx || 0, y: this.rightAxis.y || 0 };
          }
        }
      };
      readAxesFromComponent(this.leftEl, 'left');
      readAxesFromComponent(this.rightEl, 'right');

      const rig = this.el;
      const head = rig.querySelector('#head');
      const headRot = head ? head.object3D.rotation : { y: 0 };

  // Read axes
  let moveX = this.leftAxis.x;        // left-right (left stick X)
  let moveY = -this.leftAxis.y;       // forward-back (invert for forward on Quest)
  let rotX = this.rightAxis.x;        // yaw (right stick X)

  // Deadzone to avoid drift from noisy sticks
  const dz = 0.15;
  if (Math.abs(moveX) < dz) moveX = 0;
  if (Math.abs(moveY) < dz) moveY = 0;
  if (Math.abs(rotX) < dz) rotX = 0;

      // Throttle HUD updates
      this._dbgTimer += delta;
      if (this.dbg && this._dbgTimer >= 0.1) {
        this._dbgTimer = 0;
        const c = this.eventCounts;
        this.dbg.textContent = `L(${moveX.toFixed(2)},${(-moveY).toFixed(2)}) R(${rotX.toFixed(2)}) yaw=${this.yaw.toFixed(2)} | evts L:${c.left} R:${c.right} conn L:${c.connL} R:${c.connR}`;
      }

  // Desktop keys (ZQSD or WASD)
  if(this.keys['KeyW'] || this.keys['KeyZ']) moveY = -1;
  if(this.keys['KeyS']) moveY = 1;
  if(this.keys['KeyA'] || this.keys['KeyQ']) moveX = -1;
  if(this.keys['KeyD']) moveX = 1;
      if(this.keys['ArrowLeft']) rotX = -1;
      if(this.keys['ArrowRight']) rotX = 1;

      // Rotation
  const rotDelta = THREE.MathUtils.degToRad(this.data.rotateSpeed) * rotX * delta;
      this.yaw = (this.yaw + rotDelta) % TWO_PI;
      rig.object3D.rotation.y = this.yaw;

      // Movement is relative to facing direction (head yaw)
      const facing = headRot ? headRot.y + this.yaw : rig.object3D.rotation.y;
      this.dir.set(moveX, 0, moveY);
      if(this.dir.lengthSq() > 0){
        this.dir.normalize();
        // Convert stick coords to world-space based on yaw
        const sin = Math.sin(facing), cos = Math.cos(facing);
        const dx = this.dir.x * cos - this.dir.z * sin;
        const dz = this.dir.x * sin + this.dir.z * cos;
        rig.object3D.position.x += dx * this.data.moveSpeed * delta;
        rig.object3D.position.z += dz * this.data.moveSpeed * delta;
      }
    }
  });
})();
