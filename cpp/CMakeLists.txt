cmake_minimum_required(VERSION 3.20)
project(atomix_core LANGUAGES CXX)

add_library(atomix_core STATIC
  src/ParticleEngine.cpp
  src/PhysicsEngine.cpp
  src/MolecularEngine.cpp
)
target_include_directories(atomix_core PUBLIC include)
target_compile_features(atomix_core PUBLIC cxx_std_17)

if(EMSCRIPTEN)
  add_executable(atomix_core_wasm
    src/ParticleEngine.cpp
    src/PhysicsEngine.cpp
    src/MolecularEngine.cpp
  )
  target_include_directories(atomix_core_wasm PRIVATE include)
  target_compile_features(atomix_core_wasm PRIVATE cxx_std_17)
  set_target_properties(atomix_core_wasm PROPERTIES
    OUTPUT_NAME "atomix-core"
    SUFFIX ".js"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/../wasm"
  )
  target_link_options(atomix_core_wasm PRIVATE
    "-O3"
    "-sMODULARIZE=1"
    "-sEXPORT_ES6=1"
    "-sENVIRONMENT=web,worker"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sFILESYSTEM=0"
    "-sEXPORTED_FUNCTIONS=['_malloc','_free','_atomix_update_particles','_atomix_calculate_forces','_atomix_update_molecule','_atomix_electric_field']"
  )
endif()
