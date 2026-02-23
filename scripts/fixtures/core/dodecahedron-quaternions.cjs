const fs = require('fs');
const path = require('path');

// Import quaternions from the built module
const { quaternions } = require('../../a5-test.cjs');

// Helper function to calculate quaternion magnitude
function quaternionMagnitude(q) {
  return Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
}

// Helper function to normalize quaternion
function normalizeQuaternion(q) {
  const mag = quaternionMagnitude(q);
  return [q[0] / mag, q[1] / mag, q[2] / mag, q[3] / mag];
}

// Helper function to transform vector by quaternion
function transformVector(v, q) {
  // v' = q * v * q*
  // For unit quaternions, this simplifies to standard quaternion rotation
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  
  // Convert vector to quaternion (w=0)
  const vq = [x, y, z, 0];
  
  // q * v
  const temp = [
    qw * x + qy * z - qz * y,
    qw * y + qz * x - qx * z,
    qw * z + qx * y - qy * x,
    -qx * x - qy * y - qz * z
  ];
  
  // (q * v) * q* where q* = [-qx, -qy, -qz, qw]
  return [
    temp[3] * (-qx) + temp[0] * qw + temp[1] * (-qz) - temp[2] * (-qy),
    temp[3] * (-qy) + temp[1] * qw + temp[2] * (-qx) - temp[0] * (-qz),
    temp[3] * (-qz) + temp[2] * qw + temp[0] * (-qy) - temp[1] * (-qx)
  ];
}

// Generate test data for each quaternion
const quaternionData = quaternions.map((q, i) => {
  const magnitude = quaternionMagnitude(q);
  const normalized = normalizeQuaternion(q);
  
  // Transform north pole to get face center
  const northPole = [0, 0, 1];
  const faceCenter = transformVector(northPole, q);
  
  // Test orthogonal vectors
  const xAxis = [1, 0, 0];
  const yAxis = [0, 1, 0];
  const rotatedX = transformVector(xAxis, q);
  const rotatedY = transformVector(yAxis, q);
  
  return {
    index: i,
    quaternion: [q[0], q[1], q[2], q[3]],
    magnitude,
    normalized,
    faceCenter,
    testTransforms: {
      northPole: faceCenter,
      xAxis: rotatedX,
      yAxis: rotatedY,
      orthogonalityTest: rotatedX[0] * rotatedY[0] + rotatedX[1] * rotatedY[1] + rotatedX[2] * rotatedY[2]
    }
  };
});

// Calculate face center statistics
const facecenters = quaternionData.map(data => data.faceCenter);
const zValues = facecenters.map(fc => fc[2]).sort((a, b) => b - a);

// Generate ring analysis
const INV_SQRT5 = Math.sqrt(0.2);
const rings = {
  northPole: { index: 0, z: zValues[0] },
  southPole: { index: 11, z: zValues[11] },
  firstRing: {
    indices: [1, 2, 3, 4, 5],
    zValues: zValues.slice(1, 6),
    expectedZ: INV_SQRT5
  },
  secondRing: {
    indices: [6, 7, 8, 9, 10],
    zValues: zValues.slice(6, 11),
    expectedZ: -INV_SQRT5
  }
};

// Angular distribution analysis for first ring
const firstRingAngles = [];
for (let i = 1; i <= 5; i++) {
  const fc = facecenters[i];
  const angle = Math.atan2(fc[1], fc[0]);
  firstRingAngles.push(angle);
}

const angularDistribution = {
  firstRingAngles,
  angleDifferences: []
};

for (let i = 0; i < 5; i++) {
  const next = (i + 1) % 5;
  let angleDiff = firstRingAngles[next] - firstRingAngles[i];
  if (angleDiff < 0) angleDiff += 2 * Math.PI;
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
  angularDistribution.angleDifferences.push({
    from: i + 1,
    to: (next === 0 ? 5 : next + 1),
    difference: angleDiff,
    expectedDifference: 2 * Math.PI / 5
  });
}

// Validation tests
const validationTests = {
  allNormalized: quaternionData.every(data => Math.abs(data.magnitude - 1.0) < 1e-10),
  allFinite: quaternionData.every(data => 
    data.quaternion.every(component => Number.isFinite(component))
  ),
  northPoleIdentity: quaternionData[0].quaternion[0] === 0 && 
                    quaternionData[0].quaternion[1] === 0 && 
                    quaternionData[0].quaternion[2] === 0 && 
                    quaternionData[0].quaternion[3] === 1,
  southPoleCorrect: quaternionData[11].quaternion[0] === 0 && 
                   quaternionData[11].quaternion[1] === -1 && 
                   quaternionData[11].quaternion[2] === 0 && 
                   quaternionData[11].quaternion[3] === 0,
  faceCentersDistinct: facecenters.every((fc1, i) => 
    facecenters.every((fc2, j) => {
      if (i === j) return true;
      const distance = Math.sqrt(
        (fc1[0] - fc2[0]) ** 2 + 
        (fc1[1] - fc2[1]) ** 2 + 
        (fc1[2] - fc2[2]) ** 2
      );
      return distance > 0.1;
    })
  )
};

const dodecahedronQuaternionsData = {
  quaternions: quaternionData,
  rings,
  angularDistribution,
  constants: {
    INV_SQRT5,
    cosAlpha: Math.sqrt((1 + INV_SQRT5) / 2),
    sinAlpha: Math.sqrt((1 - INV_SQRT5) / 2),
    expectedPentagonAngle: 2 * Math.PI / 5
  },
  validationTests,
  metadata: {
    totalQuaternions: quaternions.length
  }
};

// Save the data to a JSON file
const fixturesDir = path.join(__dirname, './../../../tests/fixtures');
const outputPath = path.join(fixturesDir, 'dodecahedron-quaternions.json');
fs.writeFileSync(outputPath, JSON.stringify(dodecahedronQuaternionsData, null, 2));

console.log(`Generated dodecahedron quaternions fixture with ${quaternions.length} quaternions`);
console.log(`Saved to: ${outputPath}`);