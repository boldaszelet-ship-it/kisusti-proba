// Kisüsti — animáció-átvitel (retarget) Node alatt: Quaternius Universal Animation Library → a Kisüsti-figurák
// csontváza (Quaternius Ultimate Modular Men/Women, nemenként külön, mert a csontok nyugalmi helyzete eltér),
// plusz a saját, kulcskockázott mozdulatok (iszik, koccint, átad, ijedt, szid, örül), amelyek az átvitt
// álló-animációra épülnek. Kimenet: anim_ferfi.json, anim_no.json (AnimationClip.toJSON tömb + mért sebességek).
//
// Futtatás (a tools/szereplo_epit.py hívja):
//   node --import game/js/szereplok/node_three.js game/js/szereplok/atvitel.js <UAL1_Standard.glb> <kimeneti mappa>
//
// Módszer: mindkét csontváz T-pózban áll nyugalomban, ezért csontonként a világtérbeli elfordulás-különbséget
// visszük át:  Q_cél(t) = Q_forrás(t) · Q_forrás_nyug⁻¹ · Q_cél_nyug,  a csípő elmozdulását a lábhossz arányával.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
import path from 'node:path';

const [ualPath, outDir] = process.argv.slice(2);
const FPS = 30;

const load = p => new Promise((res, rej) => {
  const b = fs.readFileSync(p);
  new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej);
});

// UAL-csont → figura-csont (a GLTFLoader a pontot kiveszi a nevekből: 'UpperArm.L' → 'UpperArmL')
const MAP = {
  pelvis: 'Hips', spine_01: 'Abdomen', spine_02: 'Torso', spine_03: 'Chest', neck_01: 'Neck', Head: 'Head',
};
for (const [s, t] of [['l', 'L'], ['r', 'R']]) {
  Object.assign(MAP, {
    [`clavicle_${s}`]: `Shoulder${t}`, [`upperarm_${s}`]: `UpperArm${t}`, [`lowerarm_${s}`]: `LowerArm${t}`, [`hand_${s}`]: `Wrist${t}`,
    [`thigh_${s}`]: `UpperLeg${t}`, [`calf_${s}`]: `LowerLeg${t}`, [`foot_${s}`]: `Foot${t}`,
  });
  for (const [f, F] of [['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky'], ['thumb', 'Thumb']])
    for (let i = 1; i <= 3; i++) MAP[`${f}_0${i}_${s}`] = `${F}${i}${t}`;
}

// a játék animációnevei → UAL-klip
const UAL = {
  all_feszes: 'Idle_Loop', setal: 'Walk_Loop', setal_hivatalos: 'Walk_Formal_Loop', fut: 'Jog_Fwd_Loop', rohan: 'Sprint_Loop',
  beszel: 'Idle_Talking_Loop', ul: 'Sitting_Idle_Loop', ul_beszel: 'Sitting_Talking_Loop', leul: 'Sitting_Enter', feláll: 'Sitting_Exit',
  tancol: 'Dance_Loop', vezet: 'Driving_Loop', felvesz: 'PickUp_Table', nyul: 'Interact', szerel: 'Fixing_Kneeling',
  megrezzen: 'Hit_Chest', guggol: 'Crouch_Idle_Loop', tol: 'Push_Loop',
};
const ISMETLODO = new Set(['all_feszes', 'all', 'setal', 'setal_hivatalos', 'fut', 'rohan', 'beszel', 'ul', 'ul_beszel', 'tancol', 'vezet', 'guggol', 'tol', 'ijedt', 'szid']);

function bonesOf(root) {
  const m = {}; root.traverse(o => { if (o.isBone) m[o.name] = o; }); return m;
}
function depthSorted(bones) {
  const d = b => { let n = 0; for (let p = b.parent; p; p = p.parent) n++; return n; };
  return Object.values(bones).sort((a, b) => d(a) - d(b));
}
const wq = o => o.getWorldQuaternion(new THREE.Quaternion());
/** A glTF-csomópontok alapállása nem a kötési (bind) póz: a csontvázat a kötési mátrixokból állítjuk vissza. */
function kotesiPoz(gltf) { let sk = null; gltf.scene.traverse(o => { if (o.isSkinnedMesh && !sk) sk = o.skeleton; }); sk.pose(); gltf.scene.updateMatrixWorld(true); }
const wp = o => o.getWorldPosition(new THREE.Vector3());

async function main() {
  const src = await load(ualPath);
  const rmPath = ualPath.replace(/\.glb$/, '_RM.glb');
  const srcRM = fs.existsSync(rmPath) ? await load(rmPath) : null;
  kotesiPoz(src); if (srcRM) kotesiPoz(srcRM);
  const S = bonesOf(src.scene);
  const sRestQ = {}, sRestP = {};
  for (const n in S) { sRestQ[n] = wq(S[n]); sRestP[n] = wp(S[n]); }
  const sLeg = sRestP.pelvis.y - sRestP.foot_l.y;

  for (const [nem, fajl, umcCache] of [['ferfi', 'ferfi.glb', 'M_Farmer.glb'], ['no', 'no.glb', 'W_Casual.glb']]) {
    const tgt = await load(path.join(outDir, fajl));
    kotesiPoz(tgt);
    const T = bonesOf(tgt.scene);
    const order = depthSorted(T);
    const tRestQ = {}, tRestLocal = {}, tRestP = {};
    for (const n in T) { tRestQ[n] = wq(T[n]); tRestLocal[n] = T[n].quaternion.clone(); tRestP[n] = wp(T[n]); }
    const tLeg = tRestP.Hips.y - tRestP.FootL.y;
    const k = tLeg / sLeg;
    const inv = {}; for (const s in MAP) inv[MAP[s]] = s;
    // A Quaternius-figura csontváza: Root → Body → {Hips → törzs, UpperLeg → LowerLeg}, a FootL/R viszont a Root
    // gyereke (IK-cél). Ezért (1) a csípő elmozdulását a Body viszi (különben a comb a helyén marad, és ülésnél a
    // térd a csípő fölé kerül), (2) a lábfej helyét a lábszár végéből számoljuk minden kockán.
    const POZ = ['Body', 'Hips', 'FootL', 'FootR'];
    const restPos = {}; for (const n of POZ) restPos[n] = T[n].position.clone();
    const bodyParentInv = T.Body.parent.matrixWorld.clone().invert();
    const labfejOffset = {}; for (const o of ['L', 'R']) labfejOffset[o] = T[`LowerLeg${o}`].worldToLocal(tRestP[`Foot${o}`].clone());
    /** a lábfejek pozíciója a lábszár végén (a többi csont már beállítva, a mátrixok frissítve) */
    function labfejek(pos) {
      for (const o of ['L', 'R']) pos[`Foot${o}`] = T[`Foot${o}`].parent.worldToLocal(T[`LowerLeg${o}`].localToWorld(labfejOffset[o].clone()));
    }
    const kimenet = [], meta = { lab: k, seb: {} };

    /** Egy forrásállapotból (a forrásjelenet aktuális pózából) a cél lokális kvaterniói és pozíciói. */
    function poseFromSource() {
      const worldQ = {}, local = {};
      for (const b of order) {
        const pw = T[b.parent.name] && worldQ[b.parent.name] ? worldQ[b.parent.name] : wq(b.parent);
        let w;
        if (inv[b.name] && S[inv[b.name]]) {
          const s = inv[b.name];
          w = wq(S[s]).multiply(sRestQ[s].clone().invert()).multiply(tRestQ[b.name]);
          local[b.name] = pw.clone().invert().multiply(w);
        } else {
          local[b.name] = tRestLocal[b.name].clone();
          w = pw.clone().multiply(local[b.name]);
        }
        worldQ[b.name] = w;
      }
      const d = wp(S.pelvis).sub(sRestP.pelvis).multiplyScalar(k);
      const pos = { Hips: restPos.Hips.clone(), Body: tRestP.Body.clone().add(d).applyMatrix4(bodyParentInv) };
      for (const n in local) T[n].quaternion.copy(local[n]);
      for (const n in pos) T[n].position.copy(pos[n]);
      tgt.scene.updateMatrixWorld(true);
      labfejek(pos);
      return { local, pos };
    }
    function toClip(name, frames, dur) {
      const times = frames.map((_, i) => Math.min(dur, i / FPS));
      const tracks = [];
      for (const n of Object.keys(frames[0].local)) {
        if (!inv[n]) continue;          // csak az átvitt csontok kapnak sávot
        const v = []; for (const f of frames) { const q = f.local[n]; v.push(q.x, q.y, q.z, q.w); }
        tracks.push(new THREE.QuaternionKeyframeTrack(n + '.quaternion', times, v));
      }
      for (const n of POZ) {
        const v = []; for (const f of frames) { const p = f.pos[n]; v.push(p.x, p.y, p.z); }
        tracks.push(new THREE.VectorKeyframeTrack(n + '.position', times, v));
      }
      const c = new THREE.AnimationClip(name, dur, tracks); c.optimize();
      return c;
    }
    function sampleUAL(clipName) {
      const clip = src.animations.find(a => a.name === clipName);
      const mixer = new THREE.AnimationMixer(src.scene);
      const act = mixer.clipAction(clip); act.play();
      const n = Math.max(2, Math.round(clip.duration * FPS) + 1), frames = [];
      for (let i = 0; i < n; i++) {
        mixer.setTime(Math.min(clip.duration, i / FPS));
        src.scene.updateMatrixWorld(true);
        frames.push(poseFromSource());
      }
      act.stop(); mixer.uncacheRoot(src.scene);
      // nyugalmi helyzet vissza
      for (const nm in S) { /* a következő klip mixere úgyis felülírja */ }
      return { frames, dur: clip.duration };
    }
    const kesz = {};
    for (const [nev, cn] of Object.entries(UAL)) {
      const { frames, dur } = sampleUAL(cn);
      kesz[nev] = { frames, dur };
      kimenet.push(toClip(nev, frames, dur));
    }
    // természetes haladási sebesség (m/s, a cél lábhosszával skálázva) a gyökérmozgásos változatból
    if (srcRM) {
      for (const nev of ['setal', 'setal_hivatalos', 'fut', 'rohan']) {
        const clip = srcRM.animations.find(a => a.name === UAL[nev]);
        const mixer = new THREE.AnimationMixer(srcRM.scene); const act = mixer.clipAction(clip); act.play();
        const R = bonesOf(srcRM.scene);
        mixer.setTime(0); srcRM.scene.updateMatrixWorld(true); const a = wp(R.pelvis);
        mixer.setTime(clip.duration - 1e-4); srcRM.scene.updateMatrixWorld(true); const b = wp(R.pelvis);
        meta.seb[nev] = +(Math.hypot(b.x - a.x, b.z - a.z) / clip.duration * k).toFixed(3);
        act.stop();
      }
    }

    // a modulos csomag saját klipjei (azonos csontváz, átvitel nélkül): a nyugodt falusi állás és az integetés
    const umc = path.join(process.env.HOME, '.cache/kisusti-szereplok', umcCache);
    const ug = await load(umc); kotesiPoz(ug);
    function sampleTarget(clip) {
      const mixer = new THREE.AnimationMixer(T.Root || order[0]);
      const tr = clip.tracks.filter(t => {
        const [b, p] = t.name.split('.');
        return (p === 'quaternion' && inv[b]) || (p === 'position' && POZ.includes(b));
      });
      const c = new THREE.AnimationClip(clip.name, clip.duration, tr);
      for (const b of order) b.quaternion.copy(tRestLocal[b.name]);
      for (const n of POZ) T[n].position.copy(restPos[n]);
      const act = mixer.clipAction(c); act.play();
      const n = Math.max(2, Math.round(clip.duration * FPS) + 1), frames = [];
      for (let i = 0; i < n; i++) {
        mixer.setTime(Math.min(clip.duration, i / FPS));
        const local = {}; for (const b of order) local[b.name] = b.quaternion.clone();
        const pos = {}; for (const p of POZ) pos[p] = T[p].position.clone();
        frames.push({ local, pos });
      }
      act.stop(); mixer.uncacheRoot(mixer.getRoot());
      return { frames, dur: clip.duration };
    }
    for (const [sajat, eredeti] of [['all', 'CharacterArmature|Idle_Neutral'], ['integet', 'CharacterArmature|Wave']]) {
      const c = ug.animations.find(a => a.name === eredeti);
      const f = sampleTarget(c); kesz[sajat] = f;
      kimenet.push(toClip(sajat, f.frames, f.dur));
    }
    // ---------------------------------------------------------------- saját mozdulatok az álló pózra építve
    const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
    const smooth = t => t * t * (3 - 2 * t);
    /** csatorna-kulcsok: [[t, érték, súly]] — érték: irányvektor (aim) vagy szög (fok, forgatás) */
    function sample(keys, t) {
      if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
      for (let i = 1; i < keys.length; i++) {
        const [t1, v1, w1] = keys[i], [t0, v0, w0] = keys[i - 1];
        if (t <= t1) {
          const a = smooth((t - t0) / Math.max(1e-6, t1 - t0));
          const v = typeof v0 === 'number' ? v0 + (v1 - v0) * a : v0.clone().lerp(v1, a).normalize();
          return [v, w0 + (w1 - w0) * a];
        }
      }
      const l = keys[keys.length - 1]; return [l[1], l[2]];
    }
    function applyLocal(fr) {
      for (const n in fr.local) T[n].quaternion.copy(fr.local[n]);
      for (const n in fr.pos) T[n].position.copy(fr.pos[n]);
      tgt.scene.updateMatrixWorld(true);
    }
    const tmpQ = new THREE.Quaternion();
    function setWorld(b, nw) { const pw = wq(b.parent); b.quaternion.copy(pw.invert().multiply(nw)); b.updateMatrixWorld(true); }
    function aim(bn, cn, dir, w) {
      const b = T[bn], c = T[cn];
      const cur = wp(c).sub(wp(b)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(cur, dir);
      tmpQ.identity().slerp(q, w);
      setWorld(b, tmpQ.clone().multiply(wq(b)));
    }
    function turn(bn, axis, deg, w) {
      const q = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg * w));
      setWorld(T[bn], q.multiply(wq(T[bn])));
    }
    /** csat: [{tipus:'aim', csont, gyerek, kulcsok} | {tipus:'fordit', csont, tengely, kulcsok, rezges?:[fok, Hz]}] */
    function author(nev, dur, csat, alap = 'all') {
      const base = kesz[alap];
      const n = Math.round(dur * FPS) + 1, frames = [];
      for (let i = 0; i < n; i++) {
        const t = Math.min(dur, i / FPS);
        const bi = Math.round((t % base.dur) * FPS) % base.frames.length;
        applyLocal(base.frames[bi]);
        for (const c of csat) {
          const [v, w] = sample(c.kulcsok, t);
          if (w <= 1e-4) continue;
          if (c.tipus === 'aim') aim(c.csont, c.gyerek, c.mod ? c.mod(v.clone(), t) : v, w);
          else turn(c.csont, c.tengely, v + (c.rezges ? c.rezges[0] * Math.sin(t * c.rezges[1] * Math.PI * 2) : 0), w);
        }
        const local = {}; for (const b of order) local[b.name] = b.quaternion.clone();
        const pos = {}; for (const p of POZ) pos[p] = T[p].position.clone();
        frames.push({ local, pos });
      }
      kimenet.push(toClip(nev, frames, dur));
    }
    // irányok világtérben: a figura +Z felé néz, a bal keze +X, fent +Y
    const J = s => s === 'L' ? 1 : -1;   // tükrözés
    const kar = (o, felso, also, kulcs) => [
      { tipus: 'aim', csont: `UpperArm${o}`, gyerek: `LowerArm${o}`, kulcsok: kulcs.map(([t, w]) => [t, felso, w]) },
      { tipus: 'aim', csont: `LowerArm${o}`, gyerek: `Wrist${o}`, kulcsok: kulcs.map(([t, w]) => [t, also, w]) },
    ];
    // iszik: jobb kéz a szájhoz, fej hátra a kortynál
    author('iszik', 3.2, [
      { tipus: 'aim', csont: 'UpperArmR', gyerek: 'LowerArmR', kulcsok: [[0, V(-0.15, -0.45, 0.88), 0], [0.7, V(-0.15, -0.45, 0.88), 1], [1.1, V(-0.12, -0.25, 0.96), 1], [2.1, V(-0.12, -0.25, 0.96), 1], [2.5, V(-0.15, -0.45, 0.88), 1], [3.2, V(-0.15, -0.45, 0.88), 0]] },
      { tipus: 'aim', csont: 'LowerArmR', gyerek: 'WristR', kulcsok: [[0, V(0.15, 0.93, -0.33), 0], [0.7, V(0.2, 0.9, -0.3), 1], [1.1, V(0.25, 0.85, -0.45), 1], [2.1, V(0.25, 0.85, -0.45), 1], [2.5, V(0.2, 0.9, -0.3), 1], [3.2, V(0.15, 0.93, -0.33), 0]] },
      { tipus: 'fordit', csont: 'Head', tengely: X, kulcsok: [[0, 0, 0], [0.8, 0, 1], [1.2, -24, 1], [2.0, -24, 1], [2.4, 0, 1], [3.2, 0, 0]] },
      { tipus: 'fordit', csont: 'Chest', tengely: X, kulcsok: [[0, 0, 0], [0.8, 0, 1], [1.2, -6, 1], [2.0, -6, 1], [2.4, 0, 1], [3.2, 0, 0]] },
    ]);
    // koccint: pohár előre-fel, kis koccanás, aztán ivás
    author('koccint', 4.0, [
      { tipus: 'aim', csont: 'UpperArmR', gyerek: 'LowerArmR', kulcsok: [[0, V(-0.2, -0.3, 0.93), 0], [0.6, V(-0.2, -0.2, 0.96), 1], [0.9, V(-0.1, -0.05, 1), 1], [1.15, V(-0.2, -0.2, 0.96), 1], [1.6, V(-0.15, -0.45, 0.88), 1], [1.9, V(-0.12, -0.25, 0.96), 1], [2.9, V(-0.12, -0.25, 0.96), 1], [3.3, V(-0.15, -0.45, 0.88), 1], [4.0, V(-0.15, -0.45, 0.88), 0]] },
      { tipus: 'aim', csont: 'LowerArmR', gyerek: 'WristR', kulcsok: [[0, V(0.1, 0.5, 0.86), 0], [0.6, V(0.1, 0.55, 0.83), 1], [0.9, V(0.05, 0.45, 0.9), 1], [1.15, V(0.1, 0.55, 0.83), 1], [1.6, V(0.2, 0.9, -0.3), 1], [1.9, V(0.25, 0.85, -0.45), 1], [2.9, V(0.25, 0.85, -0.45), 1], [3.3, V(0.2, 0.9, -0.3), 1], [4.0, V(0.2, 0.9, -0.3), 0]] },
      { tipus: 'fordit', csont: 'Head', tengely: X, kulcsok: [[0, 0, 0], [1.6, 0, 1], [2.0, -24, 1], [2.8, -24, 1], [3.2, 0, 1], [4.0, 0, 0]] },
    ]);
    // átad: két kéz előre, enyhe meghajlás
    const elore = [[0, 0], [0.5, 1], [1.5, 1], [2.2, 0]];
    author('atad', 2.2, [
      ...kar('R', V(-0.12, -0.5, 0.86), V(-0.02, -0.05, 1), elore),
      ...kar('L', V(0.12, -0.5, 0.86), V(0.02, -0.05, 1), elore),
      { tipus: 'fordit', csont: 'Chest', tengely: X, kulcsok: [[0, 0, 0], [0.5, 9, 1], [1.5, 9, 1], [2.2, 0, 0]] },
      { tipus: 'fordit', csont: 'Head', tengely: X, kulcsok: [[0, 0, 0], [0.5, 8, 1], [1.5, 8, 1], [2.2, 0, 0]] },
    ]);
    // ijedt (ismétlődő): kezek az arc elé, tenyérrel kifelé, hátradőlés, remegés
    const ij = [[0, 1], [2.0, 1]];
    author('ijedt', 2.0, [
      ...kar('R', V(-0.55, -0.55, 0.62), V(0.2, 0.85, 0.48), ij),
      ...kar('L', V(0.55, -0.55, 0.62), V(-0.2, 0.85, 0.48), ij),
      { tipus: 'fordit', csont: 'Chest', tengely: X, kulcsok: [[0, -11, 1], [2.0, -11, 1]], rezges: [1.2, 7] },
      { tipus: 'fordit', csont: 'Head', tengely: X, kulcsok: [[0, -6, 1], [2.0, -6, 1]] },
      { tipus: 'fordit', csont: 'Head', tengely: Y, kulcsok: [[0, 0, 1], [2.0, 0, 1]], rezges: [9, 0.5] },
    ]);
    // szid (ismétlődő): jobb mutatóujj fenn, csóválva; bal kéz csípőn; fej előre, bólogat
    author('szid', 2.4, [
      { tipus: 'aim', csont: 'UpperArmR', gyerek: 'LowerArmR', kulcsok: [[0, V(-0.4, -0.4, 0.82), 1], [2.4, V(-0.4, -0.4, 0.82), 1]] },
      { tipus: 'aim', csont: 'LowerArmR', gyerek: 'WristR', kulcsok: [[0, V(-0.05, 0.78, 0.62), 1], [2.4, V(-0.05, 0.78, 0.62), 1]], mod: (v, t) => v.add(new THREE.Vector3(0.32 * Math.sin(t * Math.PI * 2 * 2.5), 0, 0)).normalize() },
      ...kar('L', V(0.66, -0.72, -0.25), V(-0.6, -0.73, 0.33), [[0, 1], [2.4, 1]]),
      { tipus: 'fordit', csont: 'Chest', tengely: X, kulcsok: [[0, 6, 1], [2.4, 6, 1]] },
      { tipus: 'fordit', csont: 'Head', tengely: X, kulcsok: [[0, 4, 1], [2.4, 4, 1]], rezges: [5, 1.25] },
    ]);
    // örül: két kar a magasba, kis ugrás nélkül (a régi 'jump' helyett)
    author('orul', 1.6, [
      ...kar('R', V(-0.45, 0.88, 0.15), V(-0.25, 0.96, 0.1), [[0, 0], [0.25, 1], [1.1, 1], [1.6, 0]]),
      ...kar('L', V(0.45, 0.88, 0.15), V(0.25, 0.96, 0.1), [[0, 0], [0.25, 1], [1.1, 1], [1.6, 0]]),
      { tipus: 'fordit', csont: 'Chest', tengely: X, kulcsok: [[0, 0, 0], [0.25, -8, 1], [1.1, -8, 1], [1.6, 0, 0]], rezges: [3, 3] },
    ]);
    // kerekítés: 3 tizedes (kvaternió, ~0,1°) — szemmel nem látható, a JSON fele akkora
    const json = kimenet.map(c => {
      const j = THREE.AnimationClip.toJSON(c);
      j.loop = ISMETLODO.has(c.name);
      for (const t of j.tracks) { t.times = t.times.map(x => +x.toFixed(4)); t.values = t.values.map(x => +x.toFixed(3)); }
      return j;
    });
    const out = path.join(outDir, `anim_${nem}.json`);
    fs.writeFileSync(out, JSON.stringify({ forras: 'Quaternius Universal Animation Library [Standard] (CC0) → retarget; saját: iszik, koccint, atad, ijedt, szid, orul; integet: Quaternius UMC Wave (CC0)', fps: FPS, meta, klipek: json }));
    console.log(`${path.basename(out)}: ${json.length} klip, ${Math.round(fs.statSync(out).size / 1024)} KB, lábarány ${k.toFixed(3)}, sebesség ${JSON.stringify(meta.seb)}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
