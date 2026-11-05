const assert=require('node:assert/strict');
const {coverage}=require('./category-coverage.js');
const storeys=Array.from({length:20},(_,i)=>i+1);
let data=coverage([4,5,5,6,9],storeys);
assert.equal(data.mean,5.8);assert.equal(data.anchor,6);
assert.equal(data.ranges[0].count,1);assert.equal(data.ranges[1].count,3);assert.equal(data.ranges[2].count,4);
assert.equal(data.ranges[2].percentage,80);
data=coverage([1,5],[1,2,3,4,5]);assert.equal(data.anchor,3);assert.equal(data.ranges[1].count,0);assert.equal(data.ranges[2].count,2);
data=coverage([1],storeys);assert.equal(data.ranges[2].low,1);assert.equal(data.ranges[2].high,3);assert.equal(data.ranges[0].percentage,100);
data=coverage([2,3],storeys);assert.equal(data.anchor,3); // exact midpoint chooses higher category
data=coverage([22.4,22.5,26],Array.from({length:21},(_,i)=>i*5));
assert.equal(data.buckets.find(b=>b.value===20).indices.length,1);
assert.equal(data.buckets.find(b=>b.value===25).indices.length,2);
assert.equal(data.n,3);assert.equal(data.buckets.reduce((s,b)=>s+b.indices.length,0),3);
assert.equal(coverage([null,NaN,'4',undefined],storeys).n,0);
assert.equal(coverage([3,3,3],storeys).ranges[0].percentage,100);
assert.equal(coverage([1/3],[0,.25,1/3,.5,2/3,.75,1]).anchor,1/3);
console.log('Category coverage checks passed: ordered neighbours, empty categories, endpoints, tie rule, WWR rounding, observed percentages, singletons and missing values.');
