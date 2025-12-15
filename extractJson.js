(() => {
  const table = document.querySelector('table.confluenceTable');
  if (!table) {
    console.error('Tabelle nicht gefunden');
    return;
  }

  const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const result = { chords: [] };

  for (let i = 2; i < rows.length; i += 2) {
    const headerRow = rows[i];
    const notesRow = rows[i + 1];
    if (!notesRow) break;

    const id = headerRow.querySelector('th')?.innerText.trim();
    const name = headerRow.querySelectorAll('th')[1]?.innerText.trim();

    const chordCells = Array.from(headerRow.querySelectorAll('td'));
    const noteCells = Array.from(notesRow.querySelectorAll('td'));

    const pads = [];
    chordCells.forEach((cell, idx) => {
      const key = KEY_NAMES[idx];
      const chordName = cell.innerText.trim(); // Akkordname aus Tabelle
      const notes = Array.from(noteCells[idx].querySelectorAll('p'))
        .map((p) => p.innerText.trim())
        .filter(Boolean)
        .reverse(); // tief → hoch wie in Cubase

      pads.push({ key, notes, chordName });
    });

    result.chords.push({
      id,
      name,
      pads,
    });
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
})();
