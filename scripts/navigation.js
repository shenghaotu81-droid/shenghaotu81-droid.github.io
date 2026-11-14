// Horizontal collision solver, shared by keyboard and touch controls.
export function isWalkable(x, z, obstacles, radius = .3) {
  return Math.abs(x) < 12.55 && Math.abs(z) < 11.55 && !obstacles.some(o =>
    x > o.minX - radius && x < o.maxX + radius &&
    z > o.minZ - radius && z < o.maxZ + radius);
}

export function movePlayer(position, dx, dz, obstacles, radius = .3) {
  // Substeps prevent tunnelling after a delayed frame; separate axes allow wall sliding.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
  for (let i = 0; i < steps; i++) {
    if (isWalkable(position.x + dx / steps, position.z, obstacles, radius)) position.x += dx / steps;
    if (isWalkable(position.x, position.z + dz / steps, obstacles, radius)) position.z += dz / steps;
  }
}
