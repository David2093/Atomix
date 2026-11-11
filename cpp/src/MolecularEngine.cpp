#include "AtomixCore.h"
#include <cmath>

extern "C" void atomix_update_molecule(const float* coordinates, int atom_count, const int* bond_pairs, int bond_count, float* bond_lengths) {
  if (!coordinates || !bond_pairs || !bond_lengths || atom_count <= 0 || bond_count < 0) return;
  for (int bond = 0; bond < bond_count; ++bond) {
    const int first = bond_pairs[bond * 2], second = bond_pairs[bond * 2 + 1];
    if (first < 0 || second < 0 || first >= atom_count || second >= atom_count) { bond_lengths[bond] = 0.f; continue; }
    const int a = first * 3, b = second * 3;
    const float dx = coordinates[a] - coordinates[b], dy = coordinates[a + 1] - coordinates[b + 1], dz = coordinates[a + 2] - coordinates[b + 2];
    bond_lengths[bond] = std::sqrt(dx * dx + dy * dy + dz * dz);
  }
}
