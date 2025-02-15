export function generateTestSequence() {
    // Generates mock 60-step sequence with 6 features
    return Array.from({length: 60}, () => [
      Math.random(),                 // ATR
      (Math.random() * 2) - 1,       // Order Book Imbalance
      Math.random() * 100,           // RSI
      (Math.random() - 0.5) * 0.1,   // VWAP Deviation
      Math.random() > 0.9 ? 1 : 0,   // Volume Spike
      (Math.random() * 2) - 1        // Order Flow
    ]);
  }