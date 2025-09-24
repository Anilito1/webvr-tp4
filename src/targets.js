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
      const params = new URLSearchParams(location.search);
  const safe = params.get('safe') === '1';
  const lite = params.get('lite') === '1';
  const perf = params.get('perf') === '1';
      this._disabled = lite; // full disable if lite mode
      this.slotEntities = new Array(this.slots.length).fill(null);
      this._spawnedCount = 0;
      if (safe) {
        // In safe mode, double delay and reduce max per wave for perf
        this.data.delay *= 2;
        this.data.maxPerWave = Math.min(2, this.data.maxPerWave);
      }
      if (perf) {
        // Ultra performance: only 1 target active and slower spawn
        this.data.delay *= 3;
        this.data.maxPerWave = 1;
        this._perfStaticTargets = true; // force static-body for spawned targets
      }
      if (!this._disabled) {
        this._timer = setInterval(this.spawnWave, this.data.delay);
        this.spawnWave();
      }

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
      if (this._disabled) return;
      // Performance guard: if too many dynamic bodies exist, skip spawning
  // (plus de physique) : plus de limitation sur le nombre de dynamic-body

      // Fill empty slots up to maxPerWave present simultaneously
      let active = this.slotEntities.filter(e=> !!e).length;
      const limit = Math.min(this.data.maxPerWave, this.slots.length);
      if (active >= limit) return;
      for (let i = 0; i < this.slots.length && active < limit; i++) {
        if (this.slotEntities[i]) continue; // already occupied
        const pos = this.slots[i];
        const t = document.createElement('a-entity');
        t.setAttribute('class', 'target grabbable');
        t.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
        // Alternate geometry
        if (i % 2 === 0) {
          t.setAttribute('geometry', 'primitive: box; depth: 0.5; height: 0.5; width: 0.5');
          t.setAttribute('material', 'color: #aa3333');
        } else {
          t.setAttribute('geometry', 'primitive: cone; height: 0.7; radiusBottom: 0.3; radiusTop: 0');
          t.setAttribute('material', 'color: #33aa33');
        }
        t.setAttribute('shadow', 'cast: true; receive: true');
        // (physique retirée)
        t.dataset.slotIndex = i;
        t.setAttribute('target-hit', '');
        this.el.appendChild(t);
        this.slotEntities[i] = t;
        active++;
        this._spawnedCount++;
      }
    }
  });

  // target-hit component n'est plus nécessaire (collision manuelle dans gun.js)
})();
