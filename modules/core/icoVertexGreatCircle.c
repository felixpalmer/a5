/*
   This implements the Slice & Dice Vertex great circle equal area projection for an icosahedron.
   https://doi.org/10.1559/152304006779500687
   The 120 spherical triangles used correspond to those of a spherical disdyakis triacontahedron
   (the fundamental domain of the icosahedral spherical symmetry Ih).
   There are three options for the vertex from which great circles are mapped to straight lines:
   - IVEA is the vertex-oriented projection as described in the paper
   - ISEA (swapping vertices B and C) is equivalent to Snyder's 1992 projection on the icosahedron
   - RTEA (swapping vertices A and B) corresponds to extending Snyder's 1992 projection to the rhombic triacontahedron
     (the vertex in the center of the 30 rhombic faces is used as radial vertex B)

   For the trigonometric approach, most of the equations are based on basic spherical trigonometry,
   solving the spherical triangles for unknown sides and angles.

   Spherical excess:
      E = A + B + C - Pi

   Law of sines:
      sin A   sin B   sin C
      ----- = ----- = -----
      sin a   sin b   sin c

   Law of cosines (for sides):
      cos a = cos b cos c + sin b sin c cos A
      cos b = cos c cos a + sin c sin a cos B
      cos c = cos a cos b + sin a sin b cos C

   for angles:
      cos A = -cos B cos C + sin B sin C cos a
      cos B = -cos C cos A + sin C sin A cos b
      cos C = -cos A cos B + sin A sin B cos c

   Half angle formulas, e.g.:

      S = (A + B + C) / 2
                        cos(S - B) cos(S - C)
      cos(a/2) = sqrt( ---------------------- )
                            sin(B) sin(C)

   yielding, based on half angle identity:

           a               1 + cos(a)
      cos(---) = +/- sqrt( ---------- )
           2                   2

      2 cos^2(a/2) = 1 + cos(a)

      cos(a) = 2 cos^2(a/2) - 1

                            cos(S - B) cos(S - C)
      cos(a) = 2 * sqrt( ---------------------- ) ^ 2 - 1
                              sin(B) sin(C)

                2 * cos(S - B) cos(S - C)
      cos(a) = -------------------------- - 1
                      sin(B) sin(C)

   Half side formulas, e.g.:
                        sin(s) sin(s - a)
      cos(A/2) = sqrt( ---------------------- )
                          sin(b) sin(c)

   An interesting special case for RTEA (where ABD triangle does not have a right angle) is that it is possible to solve a spherical triangle when
   knowing the spherical excess (area E), one angle and its adjacent side:

    Cosine difference identity:
       cos(a - b) = cos a cos b + sin a sin b

    Y = E + Pi - B = A + C
    C = Y - A

    cos C                     = -cos A cos B + sin A sin B cos c (cosine rule for angle)
    cos(Y - A) =              = -cos A cos B + sin A sin B cos c
    cos Y cos A + sin Y sin A = -cos A cos B + sin A sin B cos c
    sin Y sin A - sin A sin B cos c = -cos A cos B - cos Y cos A
    sin A (sin Y - sin B) cos c = cos A (-cos B - cosY)
             sin A    -cos Y - cos B
    tan A = ------- = --------------------
             cos A     sin Y - sin B cos c

   which corresponds to the formula at bottom of page 39 in John Hall DT DGGS (https://ucalgary.scholaris.ca/items/1bd11f8c-5a71-48dc-a9a8-b4a8b9021008)
   citing S. Lee and D. Mortari, 2017
       Quasi‐equal area subdivision algorithm for uniform points on a sphere with application to any geographical data distribution. 103:142–151.

   However, the signs of the numerator and denumerator are negated here, which results in the correct angle when using atan2()
*/

public import IMPORT_STATIC "ecrt"
private:

import "ri5x6"
import "Vector3D"

// Define this to use the vectorial approach based on Brenton R S Recht's blog entry at
// https://brsr.github.io/2021/08/31/snyder-equal-area.html
// with further replacement of trigonometry by vector operation for the inverse as well
 #define USE_VECTORS

public enum VGCRadialVertex { isea, ivea, rtea };

public class IVEAProjection : SliceAndDiceGreatCircleIcosahedralProjection
{
}

public class ISEAProjection : SliceAndDiceGreatCircleIcosahedralProjection
{
   radialVertex = isea;
}

public class RTEAProjection : SliceAndDiceGreatCircleIcosahedralProjection
{
   radialVertex = rtea;
}

public class SliceAndDiceGreatCircleIcosahedralProjection : RI5x6Projection
{
   VGCRadialVertex radialVertex; property::radialVertex = ivea;

   property VGCRadialVertex radialVertex
   {
      set
      {
         radialVertex = value;
         switch(value)
         {
            case isea:
               va = 0, vb = 2, vc = 1;
               break;
            case ivea:
               va = 0, vb = 1, vc = 2;
               break;
            case rtea:
               va = 1, vb = 0, vc = 2;
               break;
         }
      }
   }

   int va, vb, vc;

   static void inverseVector(const Pointd pi,
      const Pointd pai, const Pointd pbi, const Pointd pci,
      const Vector3D A, const Vector3D B, const Vector3D C,
      Vector3D P)
   {
      static const Radians areaABC = Degrees { 6 }; //sphericalTriArea(A, B, C);
      double b[3];
      Vector3D c1;

      cartesianToBary(b, pi, pai, pbi, pci, -6);

           if(b[0] > 1 - 1E-11) { P = A; return; }
      else if(b[1] > 1 - 1E-11) { P = B; return; }
      else if(b[2] > 1 - 1E-11) { P = C; return; }

      c1.CrossProduct(B, C);

      {
         double h = 1 - b[0];
         double S = sin((b[2]/h * areaABC));
         double c01 = A.DotProduct(B);
         double c12 = B.DotProduct(C);
         double c20 = C.DotProduct(A);
         double s12 = sqrt(1 - c12*c12);
         double V = A.DotProduct(c1);
         double CC = 1 - sqrt(1 - S * S);
         double f = S * V + CC * (c01 * c12 - c20);
         double g = CC * s12 * (1 + c01);
         double f2 = f * f, g2 = g * g, gf = g * f;
         double oos12tf2pg2 = fabs(f2 + g2) > 1E-11 && fabs(s12) > 1E-11 ? 1.0 / (s12 * (f2 + g2)) : 0;
         double ap = oos12tf2pg2 ? (s12 * (f2 - g2) - 2 * gf * c12) * oos12tf2pg2 : 1;
         double bp = oos12tf2pg2 ? 2 * gf * oos12tf2pg2 : 0;

         if(ap < 1E-05) ap = 0, bp = 1;

         {
            Vector3D p
            {
               ap * B.x + bp * C.x,
               ap * B.y + bp * C.y,
               ap * B.z + bp * C.z
            };
            double av = A.DotProduct(p), av2 = av * av;
            double bv = 1 + h*h * (av - 1), bv2 = bv * bv;
            double bvp = sqrt((1 - bv2) / (1 - av2));
            double avp = bv - av * bvp;
            P =
            {
               avp * A.x + bvp * p.x,
               avp * A.y + bvp * p.y,
               avp * A.z + bvp * p.z
            };
         }
      }
   }

   void inverseIcoFace(const Pointd v,
      const Pointd p1, const Pointd p2, const Pointd p3,
      const Vector3D v1, const Vector3D v2, const Vector3D v3,
      Vector3D out)
   {
      double b[3];
      Pointd pCenter {
         (p1.x + p2.x + p3.x) / 3,
         (p1.y + p2.y + p3.y) / 3
      };
      Pointd pMid;
      Vector3D vCenter {
         (v1.x + v2.x + v3.x) / 3,
         (v1.y + v2.y + v3.y) / 3,
         (v1.z + v2.z + v3.z) / 3
      };
      Vector3D vMid;
      const Pointd * p5x6[3] = { &pMid, null, &pCenter };
      const Vector3D * v3D[3] = { &vMid, null, &vCenter };
      int subTri;

      cartesianToBary(b, v, p1, p2, p3, -1);

      if(b[0] <= b[1] && b[0] <= b[2])
      {
         pMid = { (p2.x + p3.x) / 2, (p2.y + p3.y) / 2 };
         vMid = { (v2.x + v3.x) / 2, (v2.y + v3.y) / 2, (v2.z + v3.z) / 2 };

         if(b[1] < b[2])
            p5x6[1] = p3, v3D[1] = v3, subTri = 0;
         else
            p5x6[1] = p2, v3D[1] = v2, subTri = 1;
      }
      else if(b[1] <= b[0] && b[1] <= b[2])
      {
         pMid = { (p3.x + p1.x) / 2, (p3.y + p1.y) / 2 };
         vMid = { (v3.x + v1.x) / 2, (v3.y + v1.y) / 2, (v3.z + v1.z) / 2 };

         if(b[0] < b[2])
            p5x6[1] = p3, v3D[1] = v3, subTri = 2;
         else
            p5x6[1] = p1, v3D[1] = v1, subTri = 3;
      }
      else // if(b[2] <= b[0] && b[2] <= b[1])
      {
         pMid = { (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 };
         vMid = { (v1.x + v2.x) / 2, (v1.y + v2.y) / 2, (v1.z + v2.z) / 2 };

         if(b[0] < b[1])
            p5x6[1] = p2, v3D[1] = v2, subTri = 4;
         else
            p5x6[1] = p1, v3D[1] = v1, subTri = 5;
      }
      vCenter.Normalize(vCenter);
      vMid.Normalize(vMid);

      {
         int a = vb, b, c;
         if((radialVertex == ivea) ^ (subTri == 0 || subTri == 3 || subTri == 4))
            b = va, c = vc;
         else
            b = vc, c = va;
         inverseVector(v, p5x6[a], p5x6[b], p5x6[c], v3D[a], v3D[b], v3D[c], out);
      }
   }

   static void forwardVector(const Vector3D v,
      const Vector3D A, const Vector3D B, const Vector3D C,
      const Pointd pai, const Pointd pbi, const Pointd pci,
      Pointd out)
   {
      Vector3D c1, c2, p;
      double h, b[3];
       // The SDT triangle area is always 6 degrees
      static const Radians areaABC = Degrees { 6 }; //sphericalTriArea(A, B, C);

      c1.CrossProduct(A, v);
      c2.CrossProduct(B, C);
      p.CrossProduct(c1, c2);
      p.Normalize(p);

      h = sqrt((1 - A.DotProduct(v)) / (1 - A.DotProduct(p)));
      b[0] = 1 - h;
      b[2] = h * sphericalTriArea(A, B, p) / areaABC;
      b[1] = h - b[2];
      baryToCartesian(b, out, pai, pbi, pci);
   }

   void forwardIcoFace(const Vector3D v,
      const Vector3D v1, const Vector3D v2, const Vector3D v3,
      const Pointd p1, const Pointd p2, const Pointd p3,
      Pointd out)
   {
      Pointd pCenter = {
         (p1.x + p2.x + p3.x) / 3,
         (p1.y + p2.y + p3.y) / 3
      };
      Vector3D vCenter {
         (v1.x + v2.x + v3.x) / 3,
         (v1.y + v2.y + v3.y) / 3,
         (v1.z + v2.z + v3.z) / 3
      };
      Pointd pMid;
      Vector3D vMid;
      const Pointd * p5x6[3] = { &pMid, null, &pCenter };
      const Vector3D * v3D[3] = { &vMid, null, &vCenter };
      int subTri;

      // TODO: Pre-compute these planes as well
      if(vertexWithinSphericalTri(v, vCenter, v2, v3))
      {
         pMid = { (p2.x + p3.x) / 2, (p2.y + p3.y) / 2 };
         vMid = { (v2.x + v3.x) / 2, (v2.y + v3.y) / 2, (v2.z + v3.z) / 2 };

         if(vertexWithinSphericalTri(v, vCenter, vMid, v3))
            v3D[1] = v3, p5x6[1] = p3, subTri = 0;
         else
            v3D[1] = v2, p5x6[1] = p2, subTri = 1;
      }
      else if(vertexWithinSphericalTri(v, vCenter, v3, v1))
      {
         pMid = { (p3.x + p1.x) / 2, (p3.y + p1.y) / 2 };
         vMid = { (v3.x + v1.x) / 2, (v3.y + v1.y) / 2, (v3.z + v1.z) / 2 };

         if(vertexWithinSphericalTri(v, vCenter, vMid, v3))
            v3D[1] = v3, p5x6[1] = p3, subTri = 2;
         else
            v3D[1] = v1, p5x6[1] = p1, subTri = 3;
      }
      else // if(vertexWithinSphericalTri(v, vCenter, v1, v2))
      {
         pMid = { (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 };
         vMid = { (v1.x + v2.x) / 2, (v1.y + v2.y) / 2, (v1.z + v2.z) / 2 };

         if(vertexWithinSphericalTri(v, vCenter, vMid, v2))
            v3D[1] = v2, p5x6[1] = p2, subTri = 4;
         else
            v3D[1] = v1, p5x6[1] = p1, subTri = 5;
      }

      vCenter.Normalize(vCenter);
      vMid.Normalize(vMid);
      {
         int a = vb, b, c;
         if((radialVertex == ivea) ^ (subTri == 0 || subTri == 3 || subTri == 4))
            b = va, c = vc;
         else
            b = vc, c = va;
         forwardVector(v, v3D[a], v3D[b], v3D[c], p5x6[a], p5x6[b], p5x6[c], out);
      }
   }
}
