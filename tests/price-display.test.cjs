'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('prices show exact cents charged by the server instead of rounding pesos',()=>{
 const source=fs.readFileSync('simple/simple.js','utf8');const start=source.indexOf('const money='),end=source.indexOf('const toast=',start);
 const format=vm.runInNewContext(source.slice(start,end)+'money');
 assert.match(format(123.45),/123,45/);assert.match(format(0.29),/0,29/);assert.match(format(25000),/25\.000/);
});
