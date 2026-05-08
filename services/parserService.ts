
import { CompassData } from '../types';

/**
 * Parses a single line of serial data.
 * Target format: "Q0 =    69  1  Q1 =   -44  0"
 */
export const parseSerialFrame = (line: string): Partial<CompassData> | null => {
  if (!line || !line.trim()) return null;
  const cleanLine = line.trim();

  try {
    // Regex to match: Q0 = [val] [bit] Q1 = [val] [bit]
    // Handles extra spaces flexibly
    const qPattern = /Q0\s*=\s*([-\d]+)\s+(\d)\s+Q1\s*=\s*([-\d]+)\s+(\d)/i;
    const match = cleanLine.match(qPattern);

    if (match) {
      const q0 = parseInt(match[1], 10);
      const q0Bit = parseInt(match[2], 10);
      const q1 = parseInt(match[3], 10);
      const q1Bit = parseInt(match[4], 10);

      // Calculate Vector Magnitude (Pythagorean theorem)
      const magnitude = Math.floor(Math.sqrt(q0 * q0 + q1 * q1));

      // Determine Heading based on bits "00", "01", "10", "11"
      // New Requirement:
      // 00 -> Top Left (NW - 315°)
      // 01 -> Top Right (NE - 45°)
      // 10 -> Bottom Left (SW - 225°)
      // 11 -> Bottom Right (SE - 135°)
      
      const code = `${q0Bit}${q1Bit}`;
      let heading = 0;

      switch (code) {
        case "00": heading = 315; break; // Top Left
        case "01": heading = 45; break;  // Top Right
        case "10": heading = 225; break; // Bottom Left
        case "11": heading = 135; break; // Bottom Right
        default: heading = 0;
      }

      return {
        q0,
        q1,
        q0Bit,
        q1Bit,
        heading,
        magnitude,
        rawCode: cleanLine
      };
    }

    // Fallback for simple testing (CSV)
    if (cleanLine.includes(',')) {
        const parts = cleanLine.split(',');
        if (parts.length >= 2) {
             const q0 = parseFloat(parts[0]);
             const q1 = parseFloat(parts[1]);
             return {
                 q0,
                 q1,
                 q0Bit: 0,
                 q1Bit: 0,
                 heading: 0,
                 magnitude: Math.floor(Math.sqrt(q0 * q0 + q1 * q1)),
                 rawCode: cleanLine
             };
        }
    }

    return null;
  } catch (e) {
    console.warn("Parse error", e);
    return null;
  }
};
