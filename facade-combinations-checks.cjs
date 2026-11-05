const assert=require('node:assert/strict');
const {tabulate}=require('./facade-combinations.js');
const items=[
 {id:'a',direction:'North',threshold:['Loggia','Balcony']},
 {id:'b',direction:'North',threshold:['Balcony','Loggia','Loggia']},
 {id:'c',direction:'South',threshold:['Balcony']},
 {id:'d',direction:null,threshold:['Unknown']}
];
const read=(item,key)=>item[key];
const all=tabulate(items,['direction','threshold'],read);
assert.equal(all.total,4);assert.equal(all.groups.length,3);
assert.equal(all.groups[0].count,2);assert.equal(all.groups[0].percentage,50);
assert.equal(all.groups.reduce((s,g)=>s+g.count,0),4);
assert.deepEqual(all.groups[0].values,[['North'],['Balcony','Loggia']]);
const complete=tabulate(items,['direction','threshold'],read,false);
assert.equal(complete.total,3);assert.equal(complete.excluded.length,1);
assert(Math.abs(complete.groups.reduce((s,g)=>s+g.percentage,0)-100)<1e-8);
const collision=tabulate([{a:['x + y']},{a:['x','y']}],['a'],read);assert.equal(collision.groups.length,2);
assert.equal(tabulate([],['a'],read).total,0);
console.log('Combination checks passed: once-per-facade counts, multi-label canonicalization, missing-data policy, denominator and collision-safe keys.');
