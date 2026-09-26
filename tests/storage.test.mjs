import test from 'node:test';
import assert from 'node:assert/strict';
import {Mission} from '../web/src/mission.js';
import {SaveStore,SAVE_KEY,freshProfile,encodeSave,decodeSave} from '../web/src/storage.js';
function fixture(raw){
 const data=new Map(raw===null?[]:[[SAVE_KEY,raw]]);
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 return {data,storage,store:new SaveStore(()=>storage)};
}
test('bad JSON, unknown versions and invalid missions survive attempted autosaves',()=>{
 const invalid=JSON.parse(encodeSave(freshProfile(),new Mission()));invalid.active.pos=null;
 for(const raw of ['{broken','{"version":999}',JSON.stringify(invalid),'']){
  const {store,data}=fixture(raw);assert.equal(store.load(),null);
  assert.throws(()=>store.write(freshProfile(),null));assert.equal(data.get(SAVE_KEY),raw);
  store.beginNew();store.write(freshProfile(),new Mission());
  assert.ok([...data].some(([key,value])=>key.startsWith(`${SAVE_KEY}-recovery-`)&&value===raw));
  assert.ok(decodeSave(data.get(SAVE_KEY)).mission);
 }
});
test('failed backups and failed reads never permit overwriting the original',()=>{
 const {store,storage,data}=fixture('{broken');store.load();
 storage.setItem=()=>{throw new Error('quota');};assert.throws(()=>store.beginNew());assert.equal(store.blocked,true);
 assert.throws(()=>store.write(freshProfile(),null));assert.equal(data.get(SAVE_KEY),'{broken');
 storage.getItem=()=>{throw new Error('denied');};assert.throws(()=>store.load());assert.throws(()=>store.beginNew());
 assert.equal(store.blocked,true);
});
test('new profiles and valid saved missions can be written normally',()=>{
 for(const raw of [null,encodeSave(freshProfile(),new Mission())]){
  const {store,data}=fixture(raw);store.load();store.write(freshProfile(),new Mission());
  assert.ok(decodeSave(data.get(SAVE_KEY)).mission);assert.equal(data.size,1);
 }
});
