
using LinearAlgebra

# Define a matrix M
M = [-3 1 1 1; 1 -3 1 1; 1 1 -3 1; 1 1 1 -3]

# Compute the null space basis
N = nullspace(M)

print(M)

print("Null space basis:")
print(N)
print("Dimensions of the null space basis:")
print(size(N))



# Compute the spectral decomposition
F = eigen(A)

print("Eigenvalues:")
print(F.values)