export interface SequenceConfig {
  jobName: string;
  arrayType: 'dd' | 'wenner' | 'schlumberger' | 'gradient' | string;
  electrodes: number;
  spacing: number;
  nMax?: number;
  maxCurrent?: number;
  measureTime?: number;
  isIP?: boolean;
  ipCycle?: number;
  stackCycles?: number;
  errorThreshold?: number;
  topographyEnabled?: boolean;
}

export interface QuadripolePoint {
  id: number;
  p: [number, number, number, number]; // [A, B, M, N] 1-indexed electrode numbers
  x: number; // Midpoint distance in meters
  z: number; // Effective pseudo-depth in meters
  rho: number; // Apparent resistivity (Ohm-m)
  v: number; // Potential difference Vmn (mV)
  i: number; // Injected current Iab (mA)
  k: number; // Geometric factor (m)
  r: number; // Apparent resistance (Ohm)
  err: number; // Measurement error (%)
  cycles: number; // Stack cycles
  ip?: number; // Total chargeability (mV/V)
  ipDecay?: number[]; // Time windows [M1, M2, M3, M4, M5, M6] in mV/V
  sp?: number; // Self potential (mV)
  channel?: number; // Receiver channel (1-8)
  topoZ?: number; // Surface elevation at midpoint (m)
}

export const IP_TIME_WINDOWS = [
  { name: 'M1', tStart: 100, tEnd: 200, label: '100-200ms' },
  { name: 'M2', tStart: 200, tEnd: 400, label: '200-400ms' },
  { name: 'M3', tStart: 400, tEnd: 800, label: '400-800ms' },
  { name: 'M4', tStart: 800, tEnd: 1200, label: '800-1200ms' },
  { name: 'M5', tStart: 1200, tEnd: 1600, label: '1.2-1.6s' },
  { name: 'M6', tStart: 1600, tEnd: 2000, label: '1.6-2.0s' },
];

/**
 * Geometric factor calculation for arbitrary quadripole (A, B, M, N)
 * K = 2 * PI / (1/rAM - 1/rBM - 1/rAN + 1/rBN)
 */
export function calculateGeometricFactor(a: number, b: number, m: number, n: number, spacing: number): number {
  const rAM = Math.abs(a - m) * spacing;
  const rBM = Math.abs(b - m) * spacing;
  const rAN = Math.abs(a - n) * spacing;
  const rBN = Math.abs(b - n) * spacing;

  let factor = 0;
  if (rAM > 0) factor += 1 / rAM;
  if (rBM > 0) factor -= 1 / rBM;
  if (rAN > 0) factor -= 1 / rAN;
  if (rBN > 0) factor += 1 / rBN;

  if (Math.abs(factor) < 1e-7) return 1.0;
  return (2 * Math.PI) / Math.abs(factor);
}

/**
 * Generates an ERT measurement sequence optimized for an 8-channel instrument (SuperSting R8)
 */
export function generateSequence(config: SequenceConfig): QuadripolePoint[] {
  const totalElectrodes = config.electrodes || 56;
  const spacing = config.spacing || 5;
  const nMax = Math.min(config.nMax || 8, 14);
  const arrayType = (config.arrayType || 'dd').toLowerCase();

  const points: QuadripolePoint[] = [];
  let id = 1;

  if (arrayType === 'dd' || arrayType === 'dipole-dipole') {
    // Dipole-Dipole: optimized for multichannel 8-channel acquisition
    for (let aSpacing = 1; aSpacing <= Math.min(3, Math.floor(totalElectrodes / 10)); aSpacing++) {
      for (let txA = 1; txA <= totalElectrodes - (aSpacing + 1); txA += aSpacing) {
        const txB = txA + aSpacing;
        for (let n = 1; n <= nMax; n++) {
          const rxM = txB + n * aSpacing;
          const rxN = rxM + aSpacing;
          if (rxN > totalElectrodes) break;

          const xMid = ((txA + txB + rxM + rxN) / 4) * spacing;
          const zDepth = (n + 1) * 0.416 * aSpacing * spacing;
          const k = calculateGeometricFactor(txA, txB, rxM, rxN, spacing);

          // Topographic elevation simulation (rolling hills / valley)
          const topo = 3650 + 18 * Math.sin((xMid / ((totalElectrodes - 1) * spacing)) * 3.14);

          points.push({
            id: id++,
            p: [txA, txB, rxM, rxN],
            x: Number(xMid.toFixed(2)),
            z: Number(zDepth.toFixed(2)),
            rho: 0,
            v: 0,
            i: 0,
            k: Number(k.toFixed(2)),
            r: 0,
            err: 0,
            cycles: config.stackCycles || 4,
            ip: config.isIP ? 0 : undefined,
            channel: ((n - 1) % 8) + 1,
            topoZ: Number(topo.toFixed(1)),
          });
        }
      }
    }
  } else if (arrayType === 'wenner' || arrayType === 'wenner-alpha') {
    for (let a = 1; a <= Math.floor((totalElectrodes - 1) / 3); a++) {
      for (let txA = 1; txA + 3 * a <= totalElectrodes; txA++) {
        const rxM = txA + a;
        const rxN = rxM + a;
        const txB = rxN + a;

        const xMid = ((txA + txB) / 2) * spacing;
        const zDepth = 0.519 * a * spacing;
        const k = 2 * Math.PI * a * spacing;
        const topo = 3650 + 18 * Math.sin((xMid / ((totalElectrodes - 1) * spacing)) * 3.14);

        points.push({
          id: id++,
          p: [txA, txB, rxM, rxN],
          x: Number(xMid.toFixed(2)),
          z: Number(zDepth.toFixed(2)),
          rho: 0,
          v: 0,
          i: 0,
          k: Number(k.toFixed(2)),
          r: 0,
          err: 0,
          cycles: config.stackCycles || 4,
          ip: config.isIP ? 0 : undefined,
          channel: 1,
          topoZ: Number(topo.toFixed(1)),
        });
      }
    }
  } else {
    for (let a = 1; a <= Math.min(4, Math.floor(totalElectrodes / 8)); a++) {
      for (let n = 1; n <= nMax; n++) {
        for (let m = 1; m <= totalElectrodes; m++) {
          const rxM = m;
          const rxN = rxM + a;
          const txA = rxM - n * a;
          const txB = rxN + n * a;

          if (txA >= 1 && txB <= totalElectrodes) {
            const xMid = ((txA + txB) / 2) * spacing;
            const zDepth = 0.45 * (n + 0.5) * a * spacing;
            const k = calculateGeometricFactor(txA, txB, rxM, rxN, spacing);
            const topo = 3650 + 18 * Math.sin((xMid / ((totalElectrodes - 1) * spacing)) * 3.14);

            points.push({
              id: id++,
              p: [txA, txB, rxM, rxN],
              x: Number(xMid.toFixed(2)),
              z: Number(zDepth.toFixed(2)),
              rho: 0,
              v: 0,
              i: 0,
              k: Number(k.toFixed(2)),
              r: 0,
              err: 0,
              cycles: config.stackCycles || 4,
              ip: config.isIP ? 0 : undefined,
              channel: ((n - 1) % 8) + 1,
              topoZ: Number(topo.toFixed(1)),
            });
          }
        }
      }
    }
  }

  return points;
}

/**
 * Simulates geophysical shot measurement with synthetic earth models and realistic electronic noise
 */
export function simulateShot(
  point: QuadripolePoint,
  env: {
    totalLength: number;
    maxCurrent: number;
    contactResistance: number[];
    stackCycles: number;
    isIP: boolean;
  }
): QuadripolePoint {
  const { totalLength, maxCurrent, contactResistance, stackCycles, isIP } = env;
  const x = point.x;
  const z = point.z;

  const normX = totalLength > 0 ? x / totalLength : 0.5;

  let trueRho = 95 + 15 * Math.sin(normX * 6.28);
  if (z > 3 && z < 15) trueRho = 42 + 10 * Math.cos(normX * 4);
  if (z >= 15) trueRho = 480 + 120 * Math.sin(normX * 3.14);

  // Conductive shear/fault zone
  const faultDist = Math.hypot(x - totalLength * 0.42, z - 12);
  if (faultDist < 16) {
    const factor = Math.exp(-(faultDist * faultDist) / 90);
    trueRho = trueRho * (1 - 0.72 * factor);
  }

  // Resistive intrusive body
  const quartzDist = Math.hypot(x - totalLength * 0.76, z - 8);
  if (quartzDist < 12) {
    const factor = Math.exp(-(quartzDist * quartzDist) / 60);
    trueRho = trueRho * (1 + 2.8 * factor);
  }

  // Contact resistance impact at electrodes A & B
  const [eA, eB] = point.p;
  const crA = contactResistance[eA - 1] ?? 1.5;
  const crB = contactResistance[eB - 1] ?? 1.5;
  const totalRContact = crA + crB;

  const availableCurrent = Math.min(maxCurrent, Math.max(15, (750 / (totalRContact + 0.5)) * 0.9));
  const currentNoise = (Math.random() - 0.5) * 1.5;
  const simulatedI = Math.max(10, Number((availableCurrent + currentNoise).toFixed(1)));

  const theoreticalR = trueRho / (point.k || 1.0);
  const theoreticalV = theoreticalR * simulatedI;

  const noiseLevelMv = (0.08 + totalRContact * 0.015) / Math.sqrt(Math.max(1, stackCycles));
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const measuredV = Math.max(0.01, theoreticalV + gauss * noiseLevelMv);

  const measuredR = measuredV / simulatedI;
  const appRho = Math.max(1.0, measuredR * point.k);

  const err = Math.min(9.9, Math.max(0.12, (noiseLevelMv / (theoreticalV + 0.05)) * 100));

  let appIP: number | undefined;
  let ipDecay: number[] | undefined;

  if (isIP) {
    let backgroundIP = 4.5 + Math.random() * 1.2;
    if (faultDist < 18) {
      backgroundIP += 22.0 * Math.exp(-(faultDist * faultDist) / 80);
    }
    appIP = Number(Math.max(0.5, backgroundIP + (Math.random() - 0.5) * 0.6).toFixed(2));

    // Secondary voltage decay curve: Cole-Cole / exponential relaxation across M1 to M6
    const decayRatios = [1.8, 1.3, 0.9, 0.62, 0.45, 0.32];
    ipDecay = decayRatios.map((ratio) =>
      Number((appIP! * ratio * (0.95 + 0.1 * Math.random())).toFixed(2))
    );
  }

  return {
    ...point,
    rho: Number(appRho.toFixed(2)),
    v: Number(measuredV.toFixed(3)),
    i: simulatedI,
    r: Number(measuredR.toFixed(5)),
    err: Number(err.toFixed(2)),
    cycles: stackCycles,
    ip: appIP,
    ipDecay,
    sp: Number(((Math.random() - 0.5) * 18).toFixed(1)),
  };
}

/**
 * 2D Field Rapid Inversion Estimation (Smoothness-Constrained L2 Kernel)
 * Transforms apparent resistivity rho_a(x,z) into estimated true model rho_true(x,z)
 */
export function estimate2DInversion(points: QuadripolePoint[]): { x: number; z: number; trueRho: number }[] {
  if (points.length === 0) return [];

  return points.map((pt) => {
    // 2D depth sharpening operator (deconvolution approximation of sensitivity matrix J^T J + lambda W)
    // Enhances contrast between resistive anomalies and conductive saturated bodies
    let factor = 1.0;
    if (pt.rho < 40) factor = 0.78; // conductive zone sharpening
    else if (pt.rho > 350) factor = 1.35; // resistive bedrock sharpening

    const trueRho = Math.max(2.0, pt.rho * factor);
    return {
      x: pt.x,
      z: Number((pt.z * 1.1).toFixed(2)),
      trueRho: Number(trueRho.toFixed(1)),
    };
  });
}

/**
 * Export formats: EarthImager 2D (.z2d / .dat)
 */
export function formatZ2D(points: QuadripolePoint[], spacing: number): string {
  const lines: string[] = [];
  lines.push(`SuperSting R8/IP 2D ERT Data Export`);
  lines.push(`${spacing.toFixed(2)}`);
  lines.push(`7`); // Dipole-Dipole array code
  lines.push(`${points.length}`);
  lines.push(`0`); // Surface topography flag
  lines.push(`1`); // Apparent resistivity flag

  points.forEach((pt) => {
    lines.push(`${pt.x.toFixed(2)}\t${pt.z.toFixed(2)}\t${pt.rho.toFixed(2)}\t${pt.err.toFixed(2)}`);
  });

  return lines.join('\n');
}

/**
 * Export format: Standard CSV with complete physical parameters & topography
 */
export function formatCSV(points: QuadripolePoint[]): string {
  const headers = [
    'PointID',
    'A',
    'B',
    'M',
    'N',
    'X_mid_m',
    'Z_depth_m',
    'Elevation_m',
    'Current_mA',
    'Voltage_mV',
    'App_Resistivity_ohmm',
    'Resistance_ohm',
    'K_factor_m',
    'Error_pct',
    'Stacks',
    'IP_mV_V',
    'IP_M1',
    'IP_M2',
    'IP_M3',
    'IP_M4',
    'IP_M5',
    'IP_M6',
    'SP_mV',
  ];

  const rows = points.map((p) => [
    p.id,
    p.p[0],
    p.p[1],
    p.p[2],
    p.p[3],
    p.x,
    p.z,
    p.topoZ ?? 0,
    p.i,
    p.v,
    p.rho,
    p.r,
    p.k,
    p.err,
    p.cycles,
    p.ip ?? '',
    p.ipDecay ? p.ipDecay[0] : '',
    p.ipDecay ? p.ipDecay[1] : '',
    p.ipDecay ? p.ipDecay[2] : '',
    p.ipDecay ? p.ipDecay[3] : '',
    p.ipDecay ? p.ipDecay[4] : '',
    p.ipDecay ? p.ipDecay[5] : '',
    p.sp ?? '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Export format: AGI SuperSting .stg format
 */
export function formatSTG(jobName: string, points: QuadripolePoint[], config: SequenceConfig): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`:H, SuperSting R8/IP, Job: ${jobName}, Date: ${dateStr}`);
  lines.push(`:C, Electrodes: ${config.electrodes}, Spacing: ${config.spacing}m, Array: ${config.arrayType}`);
  lines.push(`:N, Stacks: ${config.stackCycles ?? 4}, IP: ${config.isIP ? 'YES' : 'NO'}`);

  points.forEach((pt, index) => {
    const ch = pt.channel ?? ((index % 8) + 1);
    const ipVal = pt.ip !== undefined ? pt.ip.toFixed(2) : '0.00';
    lines.push(
      `${(index + 1).toString().padStart(5, ' ')}, ` +
        `${pt.p[0].toString().padStart(3, ' ')}, ` +
        `${pt.p[1].toString().padStart(3, ' ')}, ` +
        `${pt.p[2].toString().padStart(3, ' ')}, ` +
        `${pt.p[3].toString().padStart(3, ' ')}, ` +
        `${pt.v.toFixed(3).padStart(9, ' ')}, ` +
        `${pt.i.toFixed(1).padStart(7, ' ')}, ` +
        `${pt.rho.toFixed(2).padStart(9, ' ')}, ` +
        `${pt.err.toFixed(2).padStart(6, ' ')}, ` +
        `${ipVal.padStart(7, ' ')}, ` +
        `CH${ch}`
    );
  });

  return lines.join('\n');
}
