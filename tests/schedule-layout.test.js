const { test } = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../schedule-layout.js');

test('range trims unused hours and rounds only occupied edge hours', () => {
  const bounds = layout.range([layout.interval('09:30','11:00'), layout.interval('13:00','15:30')]);
  assert.deepEqual(bounds, { start: 9, end: 16, columns: 7 });
  assert.deepEqual(layout.span(layout.interval('09:30','11:00'), bounds), { startCol: 1, endCol: 3 });
  assert.deepEqual(layout.span(layout.interval('13:00','15:30'), bounds), { startCol: 5, endCol: 8 });
});
test('early classes and late deadlines are included without an 08–20 clamp', () => {
  assert.deepEqual(layout.range([layout.interval('06:30','07:30'), {start:23+59/60, end:24}]), {start:6,end:24,columns:18});
});
test('empty or untimed weeks do not invent a time range', () => {
  assert.equal(layout.range([]), null);
  assert.equal(layout.range([layout.interval(null,null), null]), null);
  assert.deepEqual(layout.span(null,null), {startCol:1,endCol:2});
});
test('midnight events remain midnight while legacy class noon is preserved', () => {
  assert.deepEqual(layout.interval('00:00','01:00'), {start:0,end:1});
  assert.deepEqual(layout.interval('00:00','14:00',true), {start:12,end:14});
  assert.equal(layout.hour('24:00'),24);
  assert.equal(layout.hour('24:30'),null);
});
test('single hour and deadline-only ranges have valid grid lines', () => {
  const bounds=layout.range([{start:18.5,end:18.5+1/60}]);
  assert.deepEqual(bounds,{start:18,end:19,columns:1});
  assert.deepEqual(layout.span({start:18.5,end:18.5+1/60},bounds),{startCol:1,endCol:2});
});
test('invalid times and invalid ranges are rejected; broken end gets a bounded duration', () => {
  assert.equal(layout.hour('garbage'),null);
  assert.equal(layout.hour('09:80'),null);
  assert.equal(layout.hour('۰۹:۳۰'),9.5);
  assert.deepEqual(layout.interval('23:30','bad'),{start:23.5,end:24});
  assert.equal(layout.range([{start:NaN,end:12},{start:14,end:12},{start:-1,end:3}]),null);
});
