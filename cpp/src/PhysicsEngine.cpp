#include "AtomixCore.h"
#include <algorithm>
#include <cmath>

extern "C" float atomix_electric_field(float charge, float distance) {
  constexpr float coulomb_constant = 8.9875517923e9f;
  const float safe_distance = std::max(std::abs(distance), 1.0e-6f);
  return coulomb_constant * charge / (safe_distance * safe_distance);
}
