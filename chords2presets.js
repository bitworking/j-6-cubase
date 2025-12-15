const fs = require('fs');
const path = require('path');

// --- KONFIGURATION ---
const INPUT_FILE = 'chords.json';
const OUTPUT_DIR = './cubase_presets';
const OCTAVE_OFFSET = 0; // JSON C3 -> Cubase C1

// --- MUSIKTHEORIE MAPPING ---
// Noten zu Zahlen (0-11)
const NOTE_VALUES = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

// --- HILFSFUNKTIONEN ---

// 1. Note parsen (Name und Oktave trennen)
function parseNote(noteStr) {
  const match = noteStr.match(/([A-G][#b]?)(-?\d+)/);
  if (!match) return null;
  return {
    name: match[1],
    octave: parseInt(match[2], 10),
    midiValue: (parseInt(match[2], 10) + 1) * 12 + NOTE_VALUES[match[1]], // Grobe MIDI Berechnung
  };
}

// 2. Grundton aus Akkordnamen extrahieren (z.B. "C" aus "Cadd9/E")
function getRootFromChordName(chordName) {
  // Nimmt alles am Anfang bis zum ersten nicht-Akkord Zeichen (m, M, 7, /, etc)
  // Aber Achtung: "C#" muss als ganzes erkannt werden.
  const match = chordName.match(/^([A-G][#b]?)/);
  return match ? match[1] : 'C';
}

// 3. Mask berechnen (Das Herzstück für die Anzeige in Cubase)
function calculateMask(rootName, notesArray) {
  const rootVal = NOTE_VALUES[rootName];
  let mask = 0;

  notesArray.forEach((noteStr) => {
    const parsed = parseNote(noteStr);
    if (!parsed) return;

    const noteVal = NOTE_VALUES[parsed.name];

    // Intervall berechnen (in Halbtönen, 0 bis 11)
    let interval = (noteVal - rootVal + 12) % 12;

    // Cubase Mask Logik:
    // Intervall 0 (Root) wird in der Maske ignoriert.
    // Intervall 1 (kl. Sekunde) = Bit 0 (Wert 1)
    // Intervall 2 (gr. Sekunde) = Bit 1 (Wert 2)
    // ...
    // Intervall 7 (Quinte)      = Bit 6 (Wert 64)
    // Formel: 2 hoch (Intervall - 1)

    if (interval > 0) {
      mask |= 1 << (interval - 1);
    }
  });

  return mask;
}

// 4. Noten für XML formatieren
function formatNotesForXml(noteArray) {
  if (!noteArray) return '';
  return (
    noteArray
      .map((n) => {
        const parsed = parseNote(n);
        if (parsed) {
          return `${parsed.name}${parsed.octave + OCTAVE_OFFSET}`;
        }
        return n;
      })
      .join(';') + ';'
  );
}

// 5. XML Template erstellen
function createXML(chordSet) {
  let attributesContent = '';

  // Standard Header
  attributesContent += `      <int name="version" value="4"/>\n`;
  attributesContent += `      <int name="padCount" value="12"/>\n`;
  attributesContent += `      <int name="slotCount" value="2"/>\n`;
  attributesContent += `      <int name="monitoring" value="1"/>\n`;
  attributesContent += `      <float name="TriggerVelocity" value="0.8"/>\n`;

  chordSet.pads.forEach((pad, index) => {
    const padIndex = index + 1;

    // Intelligente Ermittlung des Grundtons
    const rootName = getRootFromChordName(pad.chordName);
    const rootKeyVal = NOTE_VALUES[rootName] !== undefined ? NOTE_VALUES[rootName] : 0;

    // Maske berechnen
    const maskVal = calculateMask(rootName, pad.notes);

    const noteString = formatNotesForXml(pad.notes);

    attributesContent += `      <int name="Mask${padIndex}" value="${maskVal}"/>\n`;
    attributesContent += `      <int name="Key${padIndex}" value="${rootKeyVal}"/>\n`;
    // Bass auf 0 lassen (Root Position), da komplexe Inversion-Erkennung den Rahmen sprengt
    attributesContent += `      <int name="Bass${padIndex}" value="0"/>\n`;
    attributesContent += `      <int name="orgType${padIndex}" value="0"/>\n`; // Custom
    attributesContent += `      <int name="ALock${padIndex}" value="1"/>\n`;
    attributesContent += `      <int name="Locked${padIndex}" value="1"/>\n`;

    // Player 1 (Piano)
    attributesContent += `      <int name="VIndex${padIndex}1" value="0"/>\n`;
    attributesContent += `      <int name="TIndex${padIndex}1" value="0"/>\n`;
    attributesContent += `      <string name="Notes${padIndex}1" value="${noteString}" wide="true"/>\n`;

    // Player 2 (Guitar)
    attributesContent += `      <int name="VIndex${padIndex}2" value="0"/>\n`;
    attributesContent += `      <int name="TIndex${padIndex}2" value="0"/>\n`;
    attributesContent += `      <string name="Notes${padIndex}2" value="${noteString}" wide="true"/>\n`;
  });

  // XML Zusammenbau
  return `<?xml version="1.0" encoding="utf-8"?>
<chordpads>
   <rootObjects>
      <root name="chordpadsdata" ID="1089220384"/>
      <root name="metadata" ID="1089224464"/>
   </rootObjects>
   <obj class="Attributes" ID="1089220384">
${attributesContent}
   </obj>
   <obj class="Attributes" ID="1089224464">
      <member name="Additional Attributes">
         <string name="MediaType" value="ChordPads"/>
      </member>
   </obj>
</chordpads>`;
}

// --- HAUPTPROGRAMM ---
try {
  if (!fs.existsSync(INPUT_FILE)) throw new Error(`Datei '${INPUT_FILE}' nicht gefunden.`);

  const jsonData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  if (!jsonData.chords) throw new Error("JSON invalid: 'chords' Array fehlt.");

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  console.log(`Verarbeite ${jsonData.chords.length} Sets...`);

  jsonData.chords.forEach((chordSet) => {
    const xmlContent = createXML(chordSet);

    // Formatierung ID: 1 -> "001"
    const paddedId = String(chordSet.id).padStart(3, '0');

    // Dateiname bereinigen
    const safeName = chordSet.name.replace(/[^a-z0-9äöüß -]/gi, '_');
    const fileName = `Roland J-6 - ${paddedId} ${safeName}.chordpads`;

    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), xmlContent);
    console.log(`[OK] ${fileName}`);
  });

  console.log(`\nFertig! Dateien liegen in '${OUTPUT_DIR}'`);
} catch (err) {
  console.error('FEHLER:', err.message);
}
