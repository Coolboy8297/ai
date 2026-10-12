/* FORGE Engine Core — dependency-free runtime utilities. */
export class Logger {
  static info(...args) { console.info("[FORGE]", ...args); }
  static warn(...args) { console.warn("[FORGE]", ...args); }
  static error(...args) { console.error("[FORGE]", ...args); }
}

export class Vec3 {
  constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z; }
  set(x,y,z) { this.x=x; this.y=y; this.z=z; return this; }
  copy(v) { return this.set(v.x,v.y,v.z); }
  clone() { return new Vec3(this.x,this.y,this.z); }
  add(v) { this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }
  sub(v) { this.x-=v.x; this.y-=v.y; this.z-=v.z; return this; }
  multiplyScalar(s) { this.x*=s; this.y*=s; this.z*=s; return this; }
  length() { return Math.hypot(this.x,this.y,this.z); }
  normalize() { const n=this.length(); if(n>1e-8)this.multiplyScalar(1/n); return this; }
  toJSON() { return {x:this.x,y:this.y,z:this.z}; }
}

export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(type, callback) {
    if(typeof callback!=="function") throw new TypeError("Event callback must be a function");
    if(!this.listeners.has(type)) this.listeners.set(type,new Set());
    this.listeners.get(type).add(callback);
    return () => this.off(type,callback);
  }
  off(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, payload) { for(const fn of [...(this.listeners.get(type)||[])]) fn(payload); }
  clear() { this.listeners.clear(); }
}

export class Entity {
  constructor(name="Entity", id=0) {
    this.id=id; this.name=name; this.active=true;
    this.components=new Map();
  }
  add(type, component) {
    if(!type) throw new TypeError("Component type is required");
    this.components.set(type,component);
    return component;
  }
  get(type) { return this.components.get(type) ?? null; }
  has(type) { return this.components.has(type); }
  remove(type) { return this.components.delete(type); }
}

export class World {
  constructor() { this.entities=new Map(); this.nextId=1; this.events=new EventBus(); }
  create(name="Entity") {
    const e=new Entity(name,this.nextId++);
    this.entities.set(e.id,e);
    this.events.emit("entity:created",e);
    return e;
  }
  destroy(id) {
    const entity=this.entities.get(id);
    if(!entity) return false;
    this.entities.delete(id); this.events.emit("entity:destroyed",entity); return true;
  }
  get(id) { return this.entities.get(id) ?? null; }
  query(...types) {
    return [...this.entities.values()].filter(e=>e.active&&types.every(t=>e.has(t)));
  }
  clear() { for(const id of [...this.entities.keys()]) this.destroy(id); }
  toJSON() {
    return [...this.entities.values()].map(e=>({
      id:e.id,name:e.name,active:e.active,
      components:Object.fromEntries([...e.components.entries()].map(([k,v])=>[k,typeof v?.toJSON==="function"?v.toJSON():v]))
    }));
  }
}

export class AABB {
  constructor(min=new Vec3(),max=new Vec3()) { this.min=min; this.max=max; }
  overlaps(other) {
    return this.min.x<=other.max.x&&this.max.x>=other.min.x&&
      this.min.y<=other.max.y&&this.max.y>=other.min.y&&
      this.min.z<=other.max.z&&this.max.z>=other.min.z;
  }
  static fromCenterSize(center,size) {
    const half=new Vec3(size.x/2,size.y/2,size.z/2);
    return new AABB(center.clone().sub(half),center.clone().add(half));
  }
}

export function rayAABB(origin,direction,box,maxDistance=Infinity) {
  let near=0,far=maxDistance;
  for(const axis of ["x","y","z"]) {
    const o=origin[axis],d=direction[axis],lo=box.min[axis],hi=box.max[axis];
    if(Math.abs(d)<1e-8) { if(o<lo||o>hi)return null; continue; }
    let a=(lo-o)/d,b=(hi-o)/d;
    if(a>b)[a,b]=[b,a];
    near=Math.max(near,a);far=Math.min(far,b);
    if(near>far)return null;
  }
  return far<0?null:{distance:near,point:origin.clone().add(direction.clone().multiplyScalar(near))};
}

export class InputActions {
  constructor() { this.bindings=new Map(); this.down=new Set(); this.previous=new Set(); }
  bind(action, codes) { this.bindings.set(action,new Set(Array.isArray(codes)?codes:[codes])); }
  updateFromKeyboardEvent(code,isDown) {
    if(isDown)this.down.add(code);else this.down.delete(code);
  }
  beginFrame() { this.previous=new Set(this.down); }
  pressed(action) { return [...(this.bindings.get(action)||[])].some(k=>this.down.has(k)); }
  justPressed(action) {
    const keys=this.bindings.get(action)||new Set();
    return [...keys].some(k=>this.down.has(k)&&!this.previous.has(k));
  }
  justReleased(action) {
    const keys=this.bindings.get(action)||new Set();
    return [...keys].some(k=>!this.down.has(k)&&this.previous.has(k));
  }
}

export class AssetCache {
  constructor() { this.entries=new Map(); }
  get(key) { const item=this.entries.get(key); if(item)item.refs++; return item?.value ?? null; }
  set(key,value) {
    const old=this.entries.get(key);
    if(old?.dispose) old.dispose();
    this.entries.set(key,{value,refs:1,dispose:typeof value?.dispose==="function"?()=>value.dispose():null});
    return value;
  }
  release(key) {
    const item=this.entries.get(key); if(!item)return;
    item.refs=Math.max(0,item.refs-1);
    if(item.refs===0){item.dispose?.();this.entries.delete(key);}
  }
  clear() { for(const item of this.entries.values())item.dispose?.();this.entries.clear(); }
  get size() { return this.entries.size; }
}

export class AudioBus {
  constructor() { this.context=null; this.master=null; this.volume=1; }
  async initialize() {
    const AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!AudioContextClass) return false;
    this.context ||= new AudioContextClass();
    this.master ||= this.context.createGain();
    this.master.gain.value=this.volume; this.master.connect(this.context.destination);
    if(this.context.state==="suspended") await this.context.resume();
    return true;
  }
  setVolume(value) {
    this.volume=Math.min(1,Math.max(0,Number(value)||0));
    if(this.master)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.015);
  }
  async playBuffer(buffer,{volume=1,loop=false}={}) {
    if(!await this.initialize()) throw new Error("Web Audio is not supported in this browser");
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=buffer;source.loop=loop;gain.gain.value=Math.max(0,volume);
    source.connect(gain);gain.connect(this.master);source.start();return source;
  }
  async loadBuffer(url) {
    if(!await this.initialize()) throw new Error("Web Audio is not supported in this browser");
    const response=await fetch(url);
    if(!response.ok)throw new Error("Audio request failed: "+response.status);
    return this.context.decodeAudioData(await response.arrayBuffer());
  }
  async shutdown() { if(this.context){await this.context.close();this.context=null;this.master=null;} }
}

export class FixedStepClock {
  constructor(step=1/60,maxFrame=0.25) { this.step=step;this.maxFrame=maxFrame;this.accumulator=0;this.elapsed=0; }
  advance(delta,update) {
    const dt=Math.min(Math.max(delta,0),this.maxFrame);this.accumulator+=dt;
    let steps=0;
    while(this.accumulator>=this.step){update(this.step);this.accumulator-=this.step;this.elapsed+=this.step;steps++;}
    return {steps,alpha:this.accumulator/this.step,delta:dt,elapsed:this.elapsed};
  }
}

export class EngineCore {
  constructor() {
    this.world=new World();
    this.events=this.world.events;
    this.input=new InputActions();
    this.assets=new AssetCache();
    this.audio=new AudioBus();
    this.clock=new FixedStepClock();
    this.version="0.2.0";
  }
  dispose() { this.world.clear();this.assets.clear();return this.audio.shutdown(); }
}
