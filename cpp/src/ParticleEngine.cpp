#include "AtomixCore.h"
#include <algorithm>
#include <cmath>

extern "C" void atomix_update_particles(float* positions, float* velocities, int count, float dt, float attraction, float repulsion, float strength) {
  if (!positions || !velocities || count <= 0) return;
  float center[3] = {0.f, 0.f, 0.f};
  for (int i = 0; i < count; ++i) for (int axis = 0; axis < 3; ++axis) center[axis] += positions[i * 3 + axis];
  for (float& value : center) value /= static_cast<float>(count);
  dt = std::clamp(dt, 0.f, .04f);
  for (int i = 0; i < count; ++i) {
    float delta[3], distance2 = 0.f;
    for (int axis = 0; axis < 3; ++axis) { delta[axis] = center[axis] - positions[i * 3 + axis]; distance2 += delta[axis] * delta[axis]; }
    const float distance = std::max(std::sqrt(distance2), .12f);
    const float radial = (attraction / distance - repulsion / (distance * distance)) * strength;
    for (int axis = 0; axis < 3; ++axis) {
      const int index = i * 3 + axis;
      velocities[index] = (velocities[index] + delta[axis] / distance * radial * dt) * .985f;
      positions[index] += velocities[index] * dt;
    }
  }
}

extern "C" void atomix_calculate_forces(const float* positions, float* forces, int count, float strength) {
  if (!positions || !forces || count <= 0) return;
  std::fill(forces, forces + count * 3, 0.f);
  for (int i = 0; i < count; ++i) for (int j = i + 1; j < count; ++j) {
    const int a = i * 3, b = j * 3;
    const float dx = positions[b] - positions[a], dy = positions[b + 1] - positions[a + 1], dz = positions[b + 2] - positions[a + 2];
    const float r2 = std::max(dx * dx + dy * dy + dz * dz, .04f), factor = strength / (r2 * std::sqrt(r2));
    forces[a] -= dx * factor; forces[a + 1] -= dy * factor; forces[a + 2] -= dz * factor;
    forces[b] += dx * factor; forces[b + 1] += dy * factor; forces[b + 2] += dz * factor;
  }
}
