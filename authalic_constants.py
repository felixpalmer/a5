# Fundamental flattening constant from WGS84 definition
INVERSE_FLATTENING = 298.257223563

# Third flattening is given by:
# n = (a - b) / (a + b), where a is the semi-major axis and b is the semi-minor axis of the ellipsoid
# The first flattening (f) is given by: 1 / f = (a - b) / a, thus rewrite n as:
THIRD_FLATTENING = 1 / (2 * INVERSE_FLATTENING - 1)

# Constants for computing coefficients from: https://arxiv.org/pdf/2212.05818
C_ξφ = [
    -4/3.0, -4/45.0, 88/315.0, 538/4725.0, 20824/467775.0, -44732/2837835.0,
    34/45.0, 8/105.0, -2482/14175.0, -37192/467775.0, -12467764/212837625.0,
    -1532/2835.0, -898/14175.0, 54968/467775.0, 100320856/1915538625.0,
    6007/14175.0, 24496/467775.0, -5884124/70945875.0,
    -23356/66825.0, -839792/19348875.0,
    570284222/1915538625.0
]

C_φξ = [
    4/3.0, 4/45.0, -16/35.0, -2582/14175.0, 60136/467775.0, 28112932/212837625.0,
    46/45.0, 152/945.0, -11966/14175.0, -21016/51975.0, 251310128/638512875.0,
    3044/2835.0, 3802/14175.0, -94388/66825.0, -8797648/10945935.0,
    6059/4725.0, 41072/93555.0, -1472637812/638512875.0,
    768272/467775.0, -455935736/638512875.0,
    4210684958/1915538625.0
]

def compute_coefficients(n, C):
    """Compute series expansion coefficients based on Horner's method.
    
    Args:
        n: Third flattening of the ellipsoid
        C: Coefficients for generation of the series expansion
    """
    cp = [0.0] * 6 

    # Using Horner's method to compute coefficients
    d = n
    cp[0] = (((((C[5] * n + C[4]) * n + C[3]) * n + C[2]) * n + C[1]) * n + C[0]) * d
    d *= n
    cp[1] = ((((C[10] * n + C[9]) * n + C[8]) * n + C[7]) * n + C[6]) * d
    d *= n
    cp[2] = (((C[14] * n + C[13]) * n + C[12]) * n + C[11]) * d
    d *= n
    cp[3] = ((C[17] * n + C[16]) * n + C[15]) * d
    d *= n
    cp[4] = (C[19] * n + C[18]) * d
    d *= n
    cp[5] = C[20] * d
    
    return cp

def main():
    # Compute coefficients
    geodetic_to_authalic = [float(f"{x:.16e}") for x in compute_coefficients(THIRD_FLATTENING, C_ξφ)]
    authalic_to_geodetic = [float(f"{x:.16e}") for x in compute_coefficients(THIRD_FLATTENING, C_φξ)]
    
    # Print coefficients
    print("geodetic_to_authalic:")
    for x in geodetic_to_authalic:
        print(f"  {x:.16e},")
    print("\nauthalic_to_geodetic:")
    for x in authalic_to_geodetic:
        print(f"  {x:.16e},")

if __name__ == "__main__":
    main() 