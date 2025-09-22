// Targets system: spawns targets at fixed slots every delay, detects projectile hits,
// plays a hit sound, and removes target.
(function(){
  const SLOT_RE = /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g;

  AFRAME.registerComponent('target-spawner', {
    schema: {
      delay: { type: 'int', default: 3000 }, // ms
      slots: { type: 'string', default: '0 1 -5' }, // space-separated vec3 list "x y z, x y z"
      maxPerWave: { type: 'int', default: 3 }
    },
    init: function(){
      this.slots = this._parseSlots(this.data.slots);
      this.spawnWave = this.spawnWave.bind(this);
      this._timer = setInterval(this.spawnWave, this.data.delay);
      this.spawnWave();

      // Audio asset inline
      const a = document.createElement('audio');
      a.src = 'https://cdn.jsdelivr.net/gh/joshwcomeau/beatfinder-assets@main/shot.wav';
      a.id = 'hitSound';
      a.crossOrigin = 'anonymous';
      document.body.appendChild(a);
      this.hitAudio = a;
    },
    remove: function(){
      if (this._timer) clearInterval(this._timer);
      if (this.hitAudio && this.hitAudio.parentNode) this.hitAudio.parentNode.removeChild(this.hitAudio);
    },
    _parseSlots: function(s){
      const res = [];
      let m; SLOT_RE.lastIndex = 0;
      while ((m = SLOT_RE.exec(s))){ res.push({x: +m[1], y: +m[2], z: +m[3]}); }
      return res.length ? res : [{x:0,y:1,z:-5}];
    },
    spawnWave: function(){
      // Clear existing targets first to respawn at same positions
      const existing = this.el.querySelectorAll('.target');
      existing.forEach(e=> e.parentNode && e.parentNode.removeChild(e));

      const n = Math.min(this.data.maxPerWave, this.slots.length);
      for (let i=0;i<n;i++){
        const pos = this.slots[i];
        const t = document.createElement('a-entity');
        t.setAttribute('class', 'target');
        t.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
        // Build geometry on the same entity so physics sees the mesh
        if (i % 2 === 0){
          t.setAttribute('geometry', 'primitive: box; depth: 0.5; height: 0.5; width: 0.5');
          t.setAttribute('material', 'color: #aa3333');
        } else {
          t.setAttribute('geometry', 'primitive: cone; height: 0.7; radiusBottom: 0.3; radiusTop: 0');
          t.setAttribute('material', 'color: #33aa33');
        }
        t.setAttribute('shadow', 'cast: true; receive: true');
        t.setAttribute('static-body', 'shape: box');
        t.setAttribute('target-hit', '');
        this.el.appendChild(t);
      }
    }
  });

  // Detect projectile collisions and play sound
  AFRAME.registerComponent('target-hit', {
    init: function(){
      this._onCollide = (e)=>{
        const other = e.detail && e.detail.body && e.detail.body.el;
        if (!other) return;
        // Heuristic: projectiles are small spheres with dynamic-body
        if (other.tagName && other.tagName.toLowerCase() === 'a-sphere'){
          // Play hit sound
          const a = document.getElementById('hitSound');
          if (a){ a.currentTime = 0; a.volume = 0.8; a.play().catch(()=>{}); }
          // Remove target
          const t = this.el;
          setTimeout(()=>{ t.parentNode && t.parentNode.removeChild(t); }, 10);
        }
      };
      this.el.addEventListener('collide', this._onCollide);
    },
    remove: function(){ this.el.removeEventListener('collide', this._onCollide); }
  });
})();
