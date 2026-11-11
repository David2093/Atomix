#pragma once

#ifdef __cplusplus
extern "C" {
#endif

void atomix_update_particles(float* positions, float* velocities, int count, float dt, float attraction, float repulsion, float strength);
void atomix_calculate_forces(const float* positions, float* forces, int count, float strength);
void atomix_update_molecule(const float* coordinates, int atom_count, const int* bond_pairs, int bond_count, float* bond_lengths);
float atomix_electric_field(float charge, float distance);

#ifdef __cplusplus
}
#endif
