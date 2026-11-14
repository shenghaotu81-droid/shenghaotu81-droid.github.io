import assert from 'node:assert/strict';
import { isWalkable, movePlayer } from './navigation.js';

// A thin exhibition wall must stop even a displacement larger than its thickness.
const wall = [{minX: 1, maxX: 1.1, minZ: -5, maxZ: 5}];
let player = {x: 0, z: 0};
movePlayer(player, 8, 0, wall);
assert(player.x < .71 && player.x > .5);
assert(isWalkable(player.x, player.z, wall));

// Diagonal contact slides along a wall without crossing it.
player = {x: 0, z: 0};
movePlayer(player, 2, 2, wall);
assert(player.x < .71 && player.z > 1.9);

// Room bounds remain enforced even for a delayed frame.
player = {x: 0, z: 0};
movePlayer(player, 100, 100, []);
assert(player.x < 12.55 && player.z < 11.55);

// No obstacle: input displacement and diagonal length are preserved.
player = {x: 0, z: 0};
movePlayer(player, -2, -3, []);
assert(Math.abs(player.x + 2) < 1e-9 && Math.abs(player.z + 3) < 1e-9);
console.log('Collision checks passed: tunnelling, sliding, bounds, displacement.');
