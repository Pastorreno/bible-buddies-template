import React, { useState, useEffect } from 'react';

const BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah',
  'Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
  '2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
];

const CHAPTER_COUNTS = {
  'Genesis':50,'Exodus':40,'Leviticus':27,'Numbers':36,'Deuteronomy':34,'Joshua':24,
  'Judges':21,'Ruth':4,'1 Samuel':31,'2 Samuel':24,'1 Kings':22,'2 Kings':25,
  '1 Chronicles':29,'2 Chronicles':36,'Ezra':10,'Nehemiah':13,'Esther':10,'Job':42,
  'Psalms':150,'Proverbs':31,'Ecclesiastes':12,'Song of Solomon':8,'Isaiah':66,
  'Jeremiah':52,'Lamentations':5,'Ezekiel':48,'Daniel':12,'Hosea':14,'Joel':3,
  'Amos':9,'Obadiah':1,'Jonah':4,'Micah':7,'Nahum':3,'Habakkuk':3,'Zephaniah':3,
  'Haggai':2,'Zechariah':14,'Malachi':4,'Matthew':28,'Mark':16,'Luke':24,'John':21,
  'Acts':28,'Romans':16,'1 Corinthians':16,'2 Corinthians':13,'Galatians':6,
  'Ephesians':6,'Philippians':4,'Colossians':4,'1 Thessalonians':5,'2 Thessalonians':3,
  '1 Timothy':6,'2 Timothy':4,'Titus':3,'Philemon':1,'Hebrews':13,'James':5,
  '1 Peter':5,'2 Peter':3,'1 John':5,'2 John':1,'3 John':1,'Jude':1,'Revelation':22,
};

async function fetchVerse(reference, translation, random = false) {
  const r = await fetch('/api/verse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, translation, random }),
  });
  return r.json();
}

export default function ScriptureTab({ translation }) {
  const [votd, setVotd] = useState(null);
  const [votdLoading, setVotdLoading] = useState(true);

  const [lookupRef, setLookupRef] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const [book, setBook] = useState('John');
  const [chapter, setChapter] = useState(1);
  const [chapterVerses, setChapterVerses] = useState(null);
  const [chapterLoading, setChapterLoading] = useState(false);

  // Verse of the day
  useEffect(() => {
    setVotdLoading(true);
    fetchVerse(null, translation, true)
      .then(d => setVotd(d))
      .finally(() => setVotdLoading(false));
  }, [translation]);

  // Verse lookup
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupRef.trim()) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    const d = await fetchVerse(lookupRef.trim(), translation);
    if (d.error) setLookupError('Verse not found. Try "John 3:16" or "Romans 8:28".');
    else setLookupResult(d);
    setLookupLoading(false);
  };

  // Chapter browser
  const loadChapter = async () => {
    setChapterLoading(true);
    setChapterVerses(null);
    const ref = `${book} ${chapter}`;
    const d = await fetchVerse(ref, translation);
    if (d.error) setChapterVerses([]);
    else {
      // bible-api returns full chapter text; split into verses if verses array present
      setChapterVerses(d);
    }
    setChapterLoading(false);
  };

  const chapCount = CHAPTER_COUNTS[book] || 50;

  return (
    <div className="scripture-tab">

      {/* Verse of the Day */}
      <section className="votd-card">
        <span className="section-label">VERSE OF THE DAY · {translation}</span>
        {votdLoading ? (
          <div className="typing-dots" style={{ marginTop: 8 }}><span /><span /><span /></div>
        ) : votd && !votd.error ? (
          <>
            <p className="votd-text">"{votd.text}"</p>
            <p className="votd-ref">— {votd.reference}</p>
          </>
        ) : (
          <p className="scripture-muted">Could not load verse of the day.</p>
        )}
      </section>

      {/* Verse Lookup */}
      <section className="scripture-section">
        <span className="section-label">VERSE LOOKUP</span>
        <form className="lookup-row" onSubmit={handleLookup}>
          <input
            className="scripture-input"
            placeholder="e.g. John 3:16 or Romans 8:28-30"
            value={lookupRef}
            onChange={e => setLookupRef(e.target.value)}
          />
          <button className="scripture-btn" type="submit" disabled={lookupLoading}>
            {lookupLoading ? '…' : 'Go'}
          </button>
        </form>
        {lookupError && <p className="scripture-error">{lookupError}</p>}
        {lookupResult && (
          <div className="verse-result">
            <p className="verse-result-ref">{lookupResult.reference} <span className="verse-translation">({translation})</span></p>
            <p className="verse-result-text">{lookupResult.text}</p>
          </div>
        )}
      </section>

      {/* Chapter Browser */}
      <section className="scripture-section">
        <span className="section-label">CHAPTER BROWSER</span>
        <div className="browser-controls">
          <select
            className="scripture-select"
            value={book}
            onChange={e => { setBook(e.target.value); setChapter(1); setChapterVerses(null); }}
          >
            {BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            className="scripture-select scripture-select-sm"
            value={chapter}
            onChange={e => { setChapter(Number(e.target.value)); setChapterVerses(null); }}
          >
            {Array.from({ length: chapCount }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button className="scripture-btn" onClick={loadChapter} disabled={chapterLoading}>
            {chapterLoading ? '…' : 'Read'}
          </button>
        </div>

        {chapterVerses && !chapterVerses.error && (
          <div className="chapter-text">
            <p className="verse-result-ref">{book} {chapter} <span className="verse-translation">({translation})</span></p>
            <p className="chapter-body">{chapterVerses.text}</p>
          </div>
        )}
        {chapterVerses && chapterVerses.error && (
          <p className="scripture-error">Could not load chapter.</p>
        )}
      </section>

    </div>
  );
}
